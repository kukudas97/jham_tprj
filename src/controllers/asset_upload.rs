#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use axum::extract::Multipart;
use calamine::{open_workbook_from_rs, Data, DataType, Reader, Xlsx};
use loco_rs::prelude::*;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use std::io::Cursor;

use crate::models::asset_categories;
use crate::models::asset_field_values;
use crate::models::asset_uploads::{self, STATUS_FAILED, STATUS_SUCCESS};
use crate::models::assets;
use crate::models::category_field_defs;
use crate::models::departments;
use crate::models::teams;
use crate::models::users;
use crate::services;
use crate::views::asset_upload::AssetUploadResponse;

// Excel 업로드 양식
// 시트명 = 대분류 (없으면 자동 생성)
// 컬럼: 자산명(필수) 부서명(필수) 팀명 관리자 품명(필수) 식별번호(필수) [추가컬럼...]
//   자산명 → 소분류 조회/자동생성, 품명 → assets.name, 식별번호 → serial_number,
//   부서명 → location, 팀명/관리자 → 커스텀 필드 조회/저장,
//   식별번호 이후 컬럼 → 커스텀 필드 자동 생성 후 저장

#[debug_handler]
pub async fn upload(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    mut multipart: Multipart,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let company_id = user
        .company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?
        .ok_or_else(|| Error::BadRequest("파일이 없습니다.".to_string()))?;

    let filename = field.file_name().unwrap_or("upload.xlsx").to_string();
    let bytes = field
        .bytes()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?;

    let (status, error_message, inserted) = parse_and_insert(&ctx.db, &bytes, company_id).await;

    let upload_record = asset_uploads::ActiveModel {
        company_id: Set(company_id),
        filename: Set(filename.clone()),
        status: Set(status.to_string()),
        error_message: Set(error_message.clone()),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    let mut response = AssetUploadResponse::from(upload_record);
    response.filename = filename;

    if error_message.is_some() {
        return format::json(response);
    }

    tracing::info!(inserted, "asset upload completed");
    format::json(response)
}

async fn parse_and_insert(
    db: &sea_orm::DatabaseConnection,
    bytes: &[u8],
    company_id: i32,
) -> (&'static str, Option<String>, usize) {
    match do_parse_and_insert(db, bytes, company_id).await {
        Ok(n) => (STATUS_SUCCESS, None, n),
        Err(e) => (STATUS_FAILED, Some(e), 0),
    }
}

/// 대분류 찾기 or 자동 생성 (캐시 갱신 포함)
async fn find_or_create_parent(
    db: &sea_orm::DatabaseConnection,
    cache: &mut Vec<asset_categories::Model>,
    name: &str,
    company_id: i32,
) -> Result<asset_categories::Model, String> {
    if let Some(existing) = cache
        .iter()
        .find(|c| c.parent_id.is_none() && c.name == name)
    {
        return Ok(existing.clone());
    }
    let new_cat = asset_categories::ActiveModel {
        name: Set(name.to_string()),
        company_id: Set(company_id),
        parent_id: Set(None),
        require_serial_number: Set(false),
        require_location: Set(false),
        require_note: Set(false),
        ..Default::default()
    }
    .insert(db)
    .await
    .map_err(|e| format!("대분류 '{}' 생성 실패: {}", name, e))?;
    tracing::info!(name, "대분류 자동 생성");
    cache.push(new_cat.clone());
    Ok(new_cat)
}

/// 소분류 찾기 or 자동 생성 (캐시 갱신 포함)
async fn find_or_create_child(
    db: &sea_orm::DatabaseConnection,
    cache: &mut Vec<asset_categories::Model>,
    children: &mut Vec<asset_categories::Model>,
    name: &str,
    parent: &asset_categories::Model,
    company_id: i32,
) -> Result<asset_categories::Model, String> {
    if let Some(existing) = children.iter().find(|c| c.name == name) {
        return Ok(existing.clone());
    }
    let new_sub = asset_categories::ActiveModel {
        name: Set(name.to_string()),
        company_id: Set(company_id),
        parent_id: Set(Some(parent.id)),
        require_serial_number: Set(false),
        require_location: Set(false),
        require_note: Set(false),
        ..Default::default()
    }
    .insert(db)
    .await
    .map_err(|e| format!("소분류 '{}' 생성 실패: {}", name, e))?;
    tracing::info!(name, parent = %parent.name, "소분류 자동 생성");
    cache.push(new_sub.clone());
    children.push(new_sub.clone());
    Ok(new_sub)
}

/// 커스텀 필드 찾기 or 자동 생성 (캐시 갱신 포함)
async fn find_or_create_field_def(
    db: &sea_orm::DatabaseConnection,
    defs_cache: &mut Vec<category_field_defs::Model>,
    label: &str,
    parent_cat: &asset_categories::Model,
    company_id: i32,
) -> Result<category_field_defs::Model, String> {
    if let Some(existing) = defs_cache
        .iter()
        .find(|d| d.category_id == parent_cat.id && (d.field_label == label || d.field_name == label))
    {
        return Ok(existing.clone());
    }
    let max_order = defs_cache
        .iter()
        .filter(|d| d.category_id == parent_cat.id)
        .map(|d| d.sort_order)
        .max()
        .unwrap_or(-1);
    let new_def = category_field_defs::ActiveModel {
        category_id: Set(parent_cat.id),
        company_id: Set(company_id),
        field_name: Set(label.to_string()),
        field_label: Set(label.to_string()),
        is_required: Set(false),
        sort_order: Set(max_order + 1),
        ..Default::default()
    }
    .insert(db)
    .await
    .map_err(|e| format!("커스텀 필드 '{}' 생성 실패: {}", label, e))?;
    tracing::info!(label, "커스텀 필드 자동 생성");
    defs_cache.push(new_def.clone());
    Ok(new_def)
}

/// serial_number로 기존 자산 조회 (soft-delete 제외)
async fn find_asset_by_serial(
    db: &sea_orm::DatabaseConnection,
    serial_number: &str,
    company_id: i32,
) -> Result<Option<assets::Model>, String> {
    use crate::models::_entities::assets::Column as AssetCol;
    assets::Entity::find()
        .filter(AssetCol::SerialNumber.eq(serial_number))
        .filter(AssetCol::CompanyId.eq(company_id))
        .filter(AssetCol::DeletedAt.is_null())
        .one(db)
        .await
        .map_err(|e| format!("자산 조회 실패: {}", e))
}

/// (asset_id, field_def_id) 기준으로 필드값 upsert
async fn upsert_field_value(
    db: &sea_orm::DatabaseConnection,
    asset_id: i32,
    field_def_id: i32,
    val: String,
) -> Result<(), String> {
    use crate::models::_entities::asset_field_values::Column as FvCol;
    let existing = asset_field_values::Entity::find()
        .filter(FvCol::AssetId.eq(asset_id))
        .filter(FvCol::FieldDefId.eq(field_def_id))
        .one(db)
        .await
        .map_err(|e| format!("필드값 조회 실패: {}", e))?;

    if let Some(existing) = existing {
        let mut active: asset_field_values::ActiveModel = existing.into();
        active.value = Set(Some(val));
        active.update(db).await.map_err(|e| format!("필드값 업데이트 실패: {}", e))?;
    } else {
        asset_field_values::ActiveModel {
            asset_id: Set(asset_id),
            field_def_id: Set(field_def_id),
            value: Set(Some(val)),
            ..Default::default()
        }
        .insert(db)
        .await
        .map_err(|e| format!("커스텀 필드 저장 실패: {}", e))?;
    }
    Ok(())
}

async fn do_parse_and_insert(
    db: &sea_orm::DatabaseConnection,
    bytes: &[u8],
    company_id: i32,
) -> Result<usize, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook: Xlsx<_> =
        open_workbook_from_rs(cursor).map_err(|e| format!("xlsx 파싱 실패: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("시트가 없습니다.".to_string());
    }

    // 변경 가능한 캐시로 로드 (자동 생성 항목 즉시 반영)
    let mut all_categories = asset_categories::Model::find_all_by_company(db, company_id)
        .await
        .map_err(|e| format!("분류 조회 실패: {}", e))?;

    let mut all_defs = category_field_defs::Model::find_by_company(db, company_id)
        .await
        .map_err(|e| format!("필드 정의 조회 실패: {}", e))?;

    let mut dept_cache: Vec<departments::Model> =
        departments::Model::find_all_active_by_company(db, company_id)
            .await
            .map_err(|e| format!("부서 조회 실패: {}", e))?;

    let mut team_cache: Vec<teams::Model> =
        teams::Model::find_all_active_by_company(db, company_id)
            .await
            .map_err(|e| format!("팀 조회 실패: {}", e))?;

    let get_str = |row: &[Data], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i)).and_then(|v| {
            let s = match v {
                Data::String(s) => s.trim().to_string(),
                Data::Int(n) => n.to_string(),
                Data::Float(f) => {
                    if f.fract() == 0.0 && *f >= i64::MIN as f64 && *f <= i64::MAX as f64 {
                        (*f as i64).to_string()
                    } else {
                        f.to_string()
                    }
                }
                Data::Bool(b) => b.to_string(),
                _ => return None,
            };
            if s.is_empty() { None } else { Some(s) }
        })
    };

    // 고정 컬럼 이름 집합 (식별번호 이후 추가 컬럼 판별용)
    const FIXED_COLS: &[&str] = &["자산명", "부서명", "팀명", "관리자", "품명", "식별번호"];

    let mut total_count = 0usize;

    for sheet_name in &sheet_names {
        // 대분류: 없으면 자동 생성
        let parent_cat =
            find_or_create_parent(db, &mut all_categories, sheet_name, company_id).await?;

        let range = workbook
            .worksheet_range(sheet_name)
            .map_err(|e| format!("'{}' 시트 읽기 실패: {}", sheet_name, e))?;

        let mut rows = range.rows();
        let header = match rows.next() {
            Some(h) => h,
            None => continue,
        };

        // 컬럼 인덱스 조회
        let col_index = |name: &str| -> Option<usize> {
            header.iter().position(|c| {
                DataType::get_string(c)
                    .map(|s| s.trim() == name)
                    .unwrap_or(false)
            })
        };

        let asset_name_col = col_index("자산명")
            .ok_or_else(|| format!("'{}' 시트: '자산명' 컬럼이 없습니다.", sheet_name))?;
        let product_name_col = col_index("품명")
            .ok_or_else(|| format!("'{}' 시트: '품명' 컬럼이 없습니다.", sheet_name))?;
        let id_num_col = col_index("식별번호")
            .ok_or_else(|| format!("'{}' 시트: '식별번호' 컬럼이 없습니다.", sheet_name))?;
        let dept_col = col_index("부서명")
            .ok_or_else(|| format!("'{}' 시트: '부서명' 컬럼이 없습니다.", sheet_name))?;
        let team_col = col_index("팀명");
        let manager_col = col_index("관리자");

        // 식별번호 이후 추가 컬럼 → 커스텀 필드 자동 생성
        let extra_cols: Vec<(usize, String)> = header
            .iter()
            .enumerate()
            .filter(|(i, _)| *i > id_num_col)
            .filter_map(|(i, c)| {
                DataType::get_string(c)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty() && !FIXED_COLS.contains(&s.as_str()))
                    .map(|s| (i, s))
            })
            .collect();

        // 추가 컬럼에 대한 커스텀 필드 찾기/생성
        let mut extra_field_defs: Vec<(usize, category_field_defs::Model)> = Vec::new();
        for (col_idx, col_label) in &extra_cols {
            let def = find_or_create_field_def(
                db,
                &mut all_defs,
                col_label,
                &parent_cat,
                company_id,
            )
            .await?;
            extra_field_defs.push((*col_idx, def));
        }

        // 소분류 캐시 (시트 내에서 새로 생성된 것도 반영)
        let mut children: Vec<asset_categories::Model> = all_categories
            .iter()
            .filter(|c| c.parent_id == Some(parent_cat.id))
            .cloned()
            .collect();

        for (row_idx, row) in rows.enumerate() {
            let row_num = row_idx + 2;

            // 품명(필수) - 빈 행 건너뜀
            let product_name = match get_str(row, Some(product_name_col)) {
                Some(v) => v,
                None => continue,
            };

            // 자산명(필수) → 소분류 찾기/생성
            let asset_name_val = get_str(row, Some(asset_name_col)).ok_or_else(|| {
                format!("'{}' 시트 {}행: '자산명'이 없습니다.", sheet_name, row_num)
            })?;

            let assigned_cat = find_or_create_child(
                db,
                &mut all_categories,
                &mut children,
                &asset_name_val,
                &parent_cat,
                company_id,
            )
            .await?;

            // 식별번호(필수)
            let id_number = get_str(row, Some(id_num_col)).ok_or_else(|| {
                format!("'{}' 시트 {}행: '식별번호'가 없습니다.", sheet_name, row_num)
            })?;

            // 부서명(필수)
            let dept_name = get_str(row, Some(dept_col)).ok_or_else(|| {
                format!("'{}' 시트 {}행: '부서명'이 없습니다.", sheet_name, row_num)
            })?;

            // 부서/팀 자동 생성 및 ID 조회
            let dept = services::department::find_or_create_department(
                db,
                &mut dept_cache,
                &dept_name,
                company_id,
            )
            .await?;

            let team_name_opt = get_str(row, team_col);
            let team_id = if let Some(ref tname) = team_name_opt {
                let team = services::department::find_or_create_team(
                    db,
                    &mut team_cache,
                    tname,
                    dept.id,
                    company_id,
                )
                .await?;
                Some(team.id)
            } else {
                None
            };

            // 동일 식별번호 자산 조회 → 있으면 업데이트, 없으면 신규 등록
            let asset =
                if let Some(existing) = find_asset_by_serial(db, &id_number, company_id).await? {
                    let mut active: assets::ActiveModel = existing.into();
                    active.name = Set(product_name);
                    active.location = Set(Some(dept_name));
                    active.category_id = Set(Some(assigned_cat.id));
                    active.department_id = Set(Some(dept.id));
                    active.team_id = Set(team_id);
                    active.update(db).await.map_err(|e| format!("DB 업데이트 실패: {}", e))?
                } else {
                    assets::ActiveModel {
                        name: Set(product_name),
                        company_id: Set(company_id),
                        serial_number: Set(id_number),
                        location: Set(Some(dept_name)),
                        note: Set(None),
                        category_id: Set(Some(assigned_cat.id)),
                        department_id: Set(Some(dept.id)),
                        team_id: Set(team_id),
                        ..Default::default()
                    }
                    .insert(db)
                    .await
                    .map_err(|e| format!("DB 저장 실패: {}", e))?
                };

            // 팀명, 관리자 → 커스텀 필드 자동 생성 후 upsert
            for (val_opt, label) in [
                (get_str(row, team_col), "팀명"),
                (get_str(row, manager_col), "관리자"),
            ] {
                if let Some(val) = val_opt {
                    let def = find_or_create_field_def(
                        db,
                        &mut all_defs,
                        label,
                        &parent_cat,
                        company_id,
                    )
                    .await?;
                    upsert_field_value(db, asset.id, def.id, val).await?;
                }
            }

            // 식별번호 이후 추가 컬럼 → 커스텀 필드 값 upsert
            for (col_idx, field_def) in &extra_field_defs {
                if let Some(val) = get_str(row, Some(*col_idx)) {
                    upsert_field_value(db, asset.id, field_def.id, val).await?;
                }
            }

            total_count += 1;
        }
    }

    if total_count == 0 {
        return Err("등록된 자산이 없습니다. 필수 컬럼(자산명, 부서명, 품명, 식별번호)과 데이터를 확인하세요.".to_string());
    }

    Ok(total_count)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/assets/")
        .add("upload", post(upload))
}
