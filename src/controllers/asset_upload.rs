#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use axum::extract::Multipart;
use calamine::{open_workbook_from_rs, Data, DataType, Reader, Xlsx};
use loco_rs::prelude::*;
use std::collections::HashMap;
use std::io::Cursor;

use crate::models::asset_categories;
use crate::models::asset_field_values;
use crate::models::asset_uploads::{self, STATUS_FAILED, STATUS_SUCCESS};
use crate::models::assets;
use crate::models::category_field_defs;
use crate::models::users;
use crate::views::asset_upload::AssetUploadResponse;

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

async fn do_parse_and_insert(
    db: &sea_orm::DatabaseConnection,
    bytes: &[u8],
    company_id: i32,
) -> Result<usize, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook: Xlsx<_> =
        open_workbook_from_rs(cursor).map_err(|e| format!("xlsx 파싱 실패: {}", e))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "시트가 없습니다.".to_string())?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("시트 읽기 실패: {}", e))?;

    let mut rows = range.rows();

    let header = rows
        .next()
        .ok_or_else(|| "헤더 행이 없습니다.".to_string())?;

    let col_index = |name: &str| -> Option<usize> {
        header.iter().position(|c| {
            DataType::get_string(c)
                .map(|s| s.eq_ignore_ascii_case(name))
                .unwrap_or(false)
        })
    };

    let name_col = col_index("name").ok_or_else(|| "name 컬럼이 없습니다.".to_string())?;
    let serial_col = col_index("serial_number");
    let location_col = col_index("location");
    let note_col = col_index("note");
    let category_col = col_index("category");
    let sub_category_col = col_index("sub_category");

    let get_str = |row: &[Data], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i)).and_then(|v| {
            let s = DataType::get_string(v).unwrap_or("").trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
    };

    // pre-load all categories for this company
    let all_categories = asset_categories::Model::find_all_by_company(db, company_id)
        .await
        .map_err(|e| format!("분류 조회 실패: {}", e))?;

    // pre-load all field defs for this company
    let all_defs = category_field_defs::Model::find_by_company(db, company_id)
        .await
        .map_err(|e| format!("필드 정의 조회 실패: {}", e))?;

    // build map: category_id → Vec<(field_name, is_required, def_id, col_idx_in_header)>
    // field column index in header (by field_name)
    let header_names: Vec<String> = header
        .iter()
        .map(|c| DataType::get_string(c).unwrap_or("").trim().to_lowercase())
        .collect();

    // group field defs by category_id
    let mut field_defs_by_cat: HashMap<i32, Vec<&category_field_defs::Model>> = HashMap::new();
    for def in &all_defs {
        field_defs_by_cat.entry(def.category_id).or_default().push(def);
    }

    // for each field def, find its column index in the header
    let def_col_map: HashMap<i32, Option<usize>> = all_defs
        .iter()
        .map(|def| {
            let idx = header_names
                .iter()
                .position(|h| h == &def.field_name.to_lowercase());
            (def.id, idx)
        })
        .collect();

    let mut count = 0usize;
    for (row_idx, row) in rows.enumerate() {
        let row_num = row_idx + 2;

        let name = match row.get(name_col).and_then(|v| DataType::get_string(v)) {
            Some(s) if !s.trim().is_empty() => s.trim().to_string(),
            _ => continue,
        };

        let category_name = get_str(row, category_col);
        let sub_category_name = get_str(row, sub_category_col);

        let category_name = category_name.ok_or_else(|| {
            format!("{}행: category(대분류) 값이 없습니다.", row_num)
        })?;

        let parent_cat = all_categories
            .iter()
            .find(|c| c.parent_id.is_none() && c.name == category_name)
            .ok_or_else(|| {
                format!("{}행: 대분류 '{}'을(를) 찾을 수 없습니다.", row_num, category_name)
            })?;

        let children: Vec<_> = all_categories
            .iter()
            .filter(|c| c.parent_id == Some(parent_cat.id))
            .collect();

        let assigned_cat = if !children.is_empty() {
            let sub_name = sub_category_name.ok_or_else(|| {
                format!(
                    "{}행: 대분류 '{}'은(는) 소분류가 필요합니다. sub_category 값이 없습니다.",
                    row_num, category_name
                )
            })?;
            children
                .iter()
                .find(|c| c.name == sub_name)
                .ok_or_else(|| {
                    format!("{}행: 소분류 '{}'을(를) 찾을 수 없습니다.", row_num, sub_name)
                })?
        } else {
            parent_cat
        };

        let serial_number = get_str(row, serial_col);
        let location = get_str(row, location_col);
        let note = get_str(row, note_col);

        if parent_cat.require_serial_number && serial_number.is_none() {
            return Err(format!(
                "{}행: '{}' 분류는 serial_number(시리얼 번호)가 필수입니다.",
                row_num, category_name
            ));
        }
        if parent_cat.require_location && location.is_none() {
            return Err(format!(
                "{}행: '{}' 분류는 location(위치)이 필수입니다.",
                row_num, category_name
            ));
        }
        if parent_cat.require_note && note.is_none() {
            return Err(format!(
                "{}행: '{}' 분류는 note(비고)가 필수입니다.",
                row_num, category_name
            ));
        }

        // validate custom field required fields
        if let Some(defs) = field_defs_by_cat.get(&parent_cat.id) {
            for def in defs {
                if def.is_required {
                    let col_idx = def_col_map.get(&def.id).and_then(|v| *v);
                    let val = get_str(row, col_idx);
                    if val.is_none() {
                        return Err(format!(
                            "{}행: '{}' 분류는 {}({})이 필수입니다.",
                            row_num, category_name, def.field_name, def.field_label
                        ));
                    }
                }
            }
        }

        let asset = assets::ActiveModel {
            name: Set(name),
            company_id: Set(company_id),
            serial_number: Set(serial_number),
            location: Set(location),
            note: Set(note),
            category_id: Set(Some(assigned_cat.id)),
            ..Default::default()
        }
        .insert(db)
        .await
        .map_err(|e| format!("DB 인서트 실패: {}", e))?;

        // save custom field values
        if let Some(defs) = field_defs_by_cat.get(&parent_cat.id) {
            for def in defs {
                let col_idx = def_col_map.get(&def.id).and_then(|v| *v);
                let val = get_str(row, col_idx);
                if let Some(v) = val {
                    asset_field_values::ActiveModel {
                        asset_id: Set(asset.id),
                        field_def_id: Set(def.id),
                        value: Set(Some(v)),
                        ..Default::default()
                    }
                    .insert(db)
                    .await
                    .map_err(|e| format!("커스텀 필드 인서트 실패: {}", e))?;
                }
            }
        }

        count += 1;
    }

    Ok(count)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/assets/")
        .add("upload", post(upload))
}
