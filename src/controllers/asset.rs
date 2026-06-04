#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use axum::extract::Multipart;
use axum::http::header;
use axum::response::IntoResponse;
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::asset_categories;
use crate::models::asset_field_values;
use crate::models::asset_inspections;
use crate::models::assets::Model;
use crate::models::category_field_defs;
use crate::models::_entities::assets::ActiveModel;
use crate::models::departments;
use crate::models::qr_codes;
use crate::models::teams;
use crate::models::users;
use crate::services;
use crate::views::asset::{AssetResponse, FieldValueResponse};
use crate::views::asset_inspection::AssetInspectionResponse;
use crate::views::qr_code::QrCodeResponse;

fn parse_date(s: &str) -> Option<chrono::NaiveDate> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FieldValueInput {
    pub field_def_pid: String,
    pub value: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub name: String,
    pub serial_number: String,
    pub location: Option<String>,
    pub note: Option<String>,
    pub category_pid: Option<String>,
    pub department_pid: Option<String>,
    pub team_pid: Option<String>,
    pub manager_name: Option<String>,
    #[serde(default)]
    pub field_values: Vec<FieldValueInput>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InspectionParams {
    pub inspector_name: String,
    pub note: Option<String>,
    #[serde(default = "default_inspection_type")]
    pub inspection_type: String,
    pub inspection_result: Option<String>,
    pub inspection_date: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
    pub remarks: Option<String>,
}

fn default_inspection_type() -> String {
    "일반점검".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetPublicResponse {
    pub pid: String,
    pub name: String,
    pub serial_number: String,
    pub location: Option<String>,
    pub note: Option<String>,
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

async fn resolve_category(
    ctx: &AppContext,
    category_pid: &Option<String>,
    company_id: i32,
) -> Result<Option<asset_categories::Model>> {
    match category_pid {
        Some(pid) => {
            let cat =
                asset_categories::Model::find_by_pid_and_company(&ctx.db, pid, company_id).await?;
            Ok(Some(cat))
        }
        None => Ok(None),
    }
}

async fn resolve_department(
    ctx: &AppContext,
    department_pid: &Option<String>,
    company_id: i32,
) -> Result<Option<departments::Model>> {
    match department_pid {
        Some(pid) => {
            let dept =
                departments::Model::find_by_pid_and_company(&ctx.db, pid, company_id).await?;
            Ok(Some(dept))
        }
        None => Ok(None),
    }
}

async fn resolve_team(
    ctx: &AppContext,
    team_pid: &Option<String>,
    company_id: i32,
) -> Result<Option<teams::Model>> {
    match team_pid {
        Some(pid) => {
            let team = teams::Model::find_by_pid_and_company(&ctx.db, pid, company_id).await?;
            Ok(Some(team))
        }
        None => Ok(None),
    }
}

async fn fetch_category_for_asset(
    ctx: &AppContext,
    category_id: Option<i32>,
) -> Result<Option<asset_categories::Model>> {
    match category_id {
        Some(id) => {
            let cat = asset_categories::Entity::find_by_id(id).one(&ctx.db).await?;
            Ok(cat)
        }
        None => Ok(None),
    }
}

async fn fetch_department_for_asset(
    ctx: &AppContext,
    department_id: Option<i32>,
) -> Result<Option<departments::Model>> {
    match department_id {
        Some(id) => {
            let dept = departments::Entity::find_by_id(id).one(&ctx.db).await?;
            Ok(dept)
        }
        None => Ok(None),
    }
}

async fn fetch_team_for_asset(
    ctx: &AppContext,
    team_id: Option<i32>,
) -> Result<Option<teams::Model>> {
    match team_id {
        Some(id) => {
            let team = teams::Entity::find_by_id(id).one(&ctx.db).await?;
            Ok(team)
        }
        None => Ok(None),
    }
}

async fn save_field_values(
    db: &sea_orm::DatabaseConnection,
    asset_id: i32,
    inputs: &[FieldValueInput],
    company_id: i32,
) -> Result<()> {
    asset_field_values::Model::delete_by_asset(db, asset_id).await?;
    if inputs.is_empty() {
        return Ok(());
    }
    let defs = category_field_defs::Model::find_by_company(db, company_id).await?;
    let def_map: HashMap<Uuid, i32> = defs.iter().map(|d| (d.pid, d.id)).collect();
    for input in inputs {
        let Ok(pid) = Uuid::parse_str(&input.field_def_pid) else { continue };
        let Some(&def_id) = def_map.get(&pid) else { continue };
        let val = input.value.as_deref().unwrap_or("").trim().to_string();
        if val.is_empty() {
            continue;
        }
        asset_field_values::ActiveModel {
            asset_id: Set(asset_id),
            field_def_id: Set(def_id),
            value: Set(Some(val)),
            ..Default::default()
        }
        .insert(db)
        .await?;
    }
    Ok(())
}

async fn build_field_value_responses(
    db: &sea_orm::DatabaseConnection,
    asset_ids: Vec<i32>,
    company_id: i32,
) -> Result<HashMap<i32, Vec<FieldValueResponse>>> {
    if asset_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let values = asset_field_values::Model::find_by_assets(db, asset_ids).await?;
    let defs = category_field_defs::Model::find_by_company(db, company_id).await?;
    let def_map: HashMap<i32, &category_field_defs::Model> =
        defs.iter().map(|d| (d.id, d)).collect();

    let mut result: HashMap<i32, Vec<FieldValueResponse>> = HashMap::new();
    for v in values {
        if let Some(def) = def_map.get(&v.field_def_id) {
            let fvr = FieldValueResponse {
                field_def_pid: def.pid,
                field_name: def.field_name.clone(),
                field_label: def.field_label.clone(),
                value: v.value,
            };
            result.entry(v.asset_id).or_default().push(fvr);
        }
    }
    Ok(result)
}

#[debug_handler]
pub async fn list(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let items = Model::find_all_by_company(&ctx.db, company_id).await?;

    let cat_ids: Vec<i32> = items.iter().filter_map(|a| a.category_id).collect();
    let cats = asset_categories::Model::find_by_ids(&ctx.db, cat_ids).await?;
    let cat_map: HashMap<i32, asset_categories::Model> =
        cats.into_iter().map(|c| (c.id, c)).collect();

    let dept_ids: Vec<i32> = items.iter().filter_map(|a| a.department_id).collect();
    let depts = departments::Model::find_by_ids(&ctx.db, dept_ids).await?;
    let dept_map: HashMap<i32, departments::Model> =
        depts.into_iter().map(|d| (d.id, d)).collect();

    let team_ids: Vec<i32> = items.iter().filter_map(|a| a.team_id).collect();
    let teams_list = teams::Model::find_by_ids(&ctx.db, team_ids).await?;
    let team_map: HashMap<i32, teams::Model> =
        teams_list.into_iter().map(|t| (t.id, t)).collect();

    let asset_ids: Vec<i32> = items.iter().map(|a| a.id).collect();
    let mut fv_map = build_field_value_responses(&ctx.db, asset_ids, company_id).await?;

    let responses: Vec<AssetResponse> = items
        .into_iter()
        .map(|a| {
            let cat = a.category_id.and_then(|id| cat_map.get(&id));
            let dept = a.department_id.and_then(|id| dept_map.get(&id));
            let team = a.team_id.and_then(|id| team_map.get(&id));
            let fvs = fv_map.remove(&a.id).unwrap_or_default();
            AssetResponse::new(a, cat, dept, team, fvs)
        })
        .collect();

    format::json(responses)
}

#[debug_handler]
pub async fn add(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let cat = resolve_category(&ctx, &params.category_pid, company_id).await?;
    let dept = resolve_department(&ctx, &params.department_pid, company_id).await?;
    let team = resolve_team(&ctx, &params.team_pid, company_id).await?;

    let mut item = ActiveModel { ..Default::default() };
    item.name = Set(params.name);
    item.serial_number = Set(params.serial_number);
    item.location = Set(params.location);
    item.note = Set(params.note);
    item.company_id = Set(company_id);
    item.category_id = Set(cat.as_ref().map(|c| c.id));
    item.department_id = Set(dept.as_ref().map(|d| d.id));
    item.team_id = Set(team.as_ref().map(|t| t.id));
    item.manager_name = Set(params.manager_name);
    let item = item.insert(&ctx.db).await?;

    save_field_values(&ctx.db, item.id, &params.field_values, company_id).await?;

    let base_url = ctx.config.server.full_url();
    let image_path = services::qr_code::generate(&item.pid.to_string(), &base_url)
        .map_err(|e| Error::Message(e.to_string()))?;
    qr_codes::ActiveModel {
        asset_id: Set(item.id),
        image_path: Set(image_path),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    let asset_id = item.id;
    let mut fv_map =
        build_field_value_responses(&ctx.db, vec![asset_id], company_id).await?;
    let fvs = fv_map.remove(&asset_id).unwrap_or_default();

    format::json(AssetResponse::new(item, cat.as_ref(), dept.as_ref(), team.as_ref(), fvs))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let cat = resolve_category(&ctx, &params.category_pid, company_id).await?;
    let dept = resolve_department(&ctx, &params.department_pid, company_id).await?;
    let team = resolve_team(&ctx, &params.team_pid, company_id).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let asset_id = asset.id;
    let mut item = asset.into_active_model();
    item.name = Set(params.name);
    item.serial_number = Set(params.serial_number);
    item.location = Set(params.location);
    item.note = Set(params.note);
    item.category_id = Set(cat.as_ref().map(|c| c.id));
    item.department_id = Set(dept.as_ref().map(|d| d.id));
    item.team_id = Set(team.as_ref().map(|t| t.id));
    item.manager_name = Set(params.manager_name);
    let item = item.update(&ctx.db).await?;

    save_field_values(&ctx.db, asset_id, &params.field_values, company_id).await?;

    let mut fv_map =
        build_field_value_responses(&ctx.db, vec![asset_id], company_id).await?;
    let fvs = fv_map.remove(&asset_id).unwrap_or_default();

    format::json(AssetResponse::new(item, cat.as_ref(), dept.as_ref(), team.as_ref(), fvs))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let asset_id = asset.id;

    // QR 코드 삭제 (파일 포함)
    if let Some(qr) = qr_codes::Model::find_by_asset(&ctx.db, asset_id).await? {
        let _ = std::fs::remove_file(&qr.image_path);
        qr.into_active_model().delete(&ctx.db).await?;
    }

    // 사진 파일 삭제
    if let Some(ref photo_path) = asset.photo_path {
        let _ = std::fs::remove_file(photo_path);
    }

    // 점검 이력 삭제
    asset_inspections::Model::delete_by_asset(&ctx.db, asset_id).await?;

    // 자산 하드 삭제 (asset_field_values는 FK CASCADE로 자동 삭제)
    asset.into_active_model().delete(&ctx.db).await?;
    format::empty()
}

#[debug_handler]
pub async fn get_one(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let item = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let asset_id = item.id;
    let cat = fetch_category_for_asset(&ctx, item.category_id).await?;
    let dept = fetch_department_for_asset(&ctx, item.department_id).await?;
    let team = fetch_team_for_asset(&ctx, item.team_id).await?;
    let mut fv_map =
        build_field_value_responses(&ctx.db, vec![asset_id], company_id).await?;
    let fvs = fv_map.remove(&asset_id).unwrap_or_default();
    format::json(AssetResponse::new(item, cat.as_ref(), dept.as_ref(), team.as_ref(), fvs))
}

#[debug_handler]
pub async fn get_public(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let asset = Model::find_by_pid(&ctx.db, &pid)
        .await
        .map_err(|_| Error::NotFound)?;
    format::json(AssetPublicResponse {
        pid: asset.pid.to_string(),
        name: asset.name,
        serial_number: asset.serial_number,
        location: asset.location,
        note: asset.note,
    })
}

#[debug_handler]
pub async fn add_public_inspection(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<InspectionParams>,
) -> Result<Response> {
    let asset = Model::find_by_pid(&ctx.db, &pid)
        .await
        .map_err(|_| Error::NotFound)?;
    let mut item = asset_inspections::ActiveModel { ..Default::default() };
    item.asset_id = Set(asset.id);
    item.inspector_name = Set(params.inspector_name);
    item.note = Set(params.note);
    item.inspection_type = Set(params.inspection_type);
    item.inspection_result = Set(params.inspection_result);
    item.inspection_date = Set(params.inspection_date.as_deref().and_then(parse_date));
    item.period_start = Set(params.period_start.as_deref().and_then(parse_date));
    item.period_end = Set(params.period_end.as_deref().and_then(parse_date));
    item.remarks = Set(params.remarks);
    let item = item.insert(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn get_qr(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    let base_url = ctx.config.server.full_url();
    let image_path = services::qr_code::generate(&asset.pid.to_string(), &base_url)
        .map_err(|e| Error::Message(e.to_string()))?;

    let existing_qr = qr_codes::Model::find_by_asset(&ctx.db, asset.id).await?;
    let qr = match existing_qr {
        Some(stale) => {
            let mut active = stale.into_active_model();
            active.image_path = Set(image_path);
            active.update(&ctx.db).await?
        }
        None => {
            qr_codes::ActiveModel {
                asset_id: Set(asset.id),
                image_path: Set(image_path),
                ..Default::default()
            }
            .insert(&ctx.db)
            .await?
        }
    };

    format::json(QrCodeResponse::from(qr))
}

#[debug_handler]
pub async fn list_inspections(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let items = asset_inspections::Model::find_all_by_asset(&ctx.db, asset.id).await?;
    format::json(
        items
            .into_iter()
            .map(AssetInspectionResponse::from)
            .collect::<Vec<_>>(),
    )
}

#[debug_handler]
pub async fn add_inspection(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<InspectionParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let mut item = asset_inspections::ActiveModel { ..Default::default() };
    item.asset_id = Set(asset.id);
    item.inspector_name = Set(params.inspector_name);
    item.note = Set(params.note);
    item.inspection_type = Set(params.inspection_type);
    item.inspection_result = Set(params.inspection_result);
    item.inspection_date = Set(params.inspection_date.as_deref().and_then(parse_date));
    item.period_start = Set(params.period_start.as_deref().and_then(parse_date));
    item.period_end = Set(params.period_end.as_deref().and_then(parse_date));
    item.remarks = Set(params.remarks);
    let item = item.insert(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn upload_photo(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    mut multipart: Multipart,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?
        .ok_or_else(|| Error::BadRequest("파일이 없습니다.".to_string()))?;

    let content_type = field.content_type().unwrap_or("").to_string();
    if !content_type.starts_with("image/") {
        return Err(Error::BadRequest("이미지 파일만 업로드 가능합니다.".to_string()));
    }

    let ext = match content_type.as_str() {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    };

    let bytes = field
        .bytes()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?;

    let dir = "uploads/photos";
    std::fs::create_dir_all(dir).map_err(|e| Error::Message(e.to_string()))?;

    let filename = format!("{}.{}", asset.pid, ext);
    let path = format!("{}/{}", dir, filename);
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| Error::Message(e.to_string()))?;

    let asset_id = asset.id;
    let dept_id = asset.department_id;
    let team_id = asset.team_id;
    let mut active = asset.into_active_model();
    active.photo_path = Set(Some(path));
    let updated = active.update(&ctx.db).await?;

    let cat = fetch_category_for_asset(&ctx, updated.category_id).await?;
    let dept = fetch_department_for_asset(&ctx, dept_id).await?;
    let team = fetch_team_for_asset(&ctx, team_id).await?;
    let mut fv_map = build_field_value_responses(&ctx.db, vec![asset_id], company_id).await?;
    let fvs = fv_map.remove(&asset_id).unwrap_or_default();

    format::json(AssetResponse::new(updated, cat.as_ref(), dept.as_ref(), team.as_ref(), fvs))
}

// ─── 통계: 부서/팀별 평가금액 합계 ────────────────────────────────────────────
#[debug_handler]
pub async fn dept_value_summary(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    use sea_orm::{DbBackend, FromQueryResult, Statement};
    use crate::views::asset::{DepartmentValueSummary, TeamValueSummary};

    let company_id = get_company_id(&auth, &ctx).await?;

    #[derive(Debug, FromQueryResult)]
    struct Row {
        department_name: Option<String>,
        team_name: Option<String>,
        asset_count: i64,
        total_appraised_value: i64,
    }

    let rows = Row::find_by_statement(Statement::from_sql_and_values(
        DbBackend::Postgres,
        r#"
            SELECT
                d.name AS department_name,
                t.name AS team_name,
                COUNT(a.id)::bigint AS asset_count,
                COALESCE(SUM(a.appraised_value), 0)::bigint AS total_appraised_value
            FROM assets a
            LEFT JOIN departments d ON a.department_id = d.id
            LEFT JOIN teams t ON a.team_id = t.id
            WHERE a.company_id = $1 AND a.deleted_at IS NULL
            GROUP BY d.name, t.name
            ORDER BY d.name NULLS LAST, t.name NULLS LAST
        "#,
        [company_id.into()],
    ))
    .all(&ctx.db)
    .await?;

    let mut result: Vec<DepartmentValueSummary> = Vec::new();
    for row in rows {
        if let Some(last) = result.last_mut() {
            if last.department_name == row.department_name {
                last.asset_count += row.asset_count;
                last.total_appraised_value += row.total_appraised_value;
                last.teams.push(TeamValueSummary {
                    team_name: row.team_name,
                    asset_count: row.asset_count,
                    total_appraised_value: row.total_appraised_value,
                });
                continue;
            }
        }
        result.push(DepartmentValueSummary {
            department_name: row.department_name.clone(),
            asset_count: row.asset_count,
            total_appraised_value: row.total_appraised_value,
            teams: vec![TeamValueSummary {
                team_name: row.team_name,
                asset_count: row.asset_count,
                total_appraised_value: row.total_appraised_value,
            }],
        });
    }

    format::json(result)
}

// ─── 통계: 부서별 자산분류 합계 ───────────────────────────────────────────────
#[debug_handler]
pub async fn category_by_dept_summary(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    use sea_orm::{DbBackend, FromQueryResult, Statement};
    use std::collections::{HashMap, HashSet};
    use crate::views::asset::{CategoryByDeptResponse, CategoryCell, DeptCategoryRow};

    let company_id = get_company_id(&auth, &ctx).await?;

    #[derive(Debug, FromQueryResult)]
    struct Row {
        department_name: Option<String>,
        category_name: Option<String>,
        asset_count: i64,
        total_appraised_value: i64,
    }

    let rows = Row::find_by_statement(Statement::from_sql_and_values(
        DbBackend::Postgres,
        r#"
            SELECT
                d.name AS department_name,
                c.name AS category_name,
                COUNT(a.id)::bigint AS asset_count,
                COALESCE(SUM(a.appraised_value), 0)::bigint AS total_appraised_value
            FROM assets a
            LEFT JOIN departments d ON a.department_id = d.id
            LEFT JOIN asset_categories c ON a.category_id = c.id
            WHERE a.company_id = $1 AND a.deleted_at IS NULL
            GROUP BY d.name, c.name
            ORDER BY d.name NULLS LAST, c.name NULLS LAST
        "#,
        [company_id.into()],
    ))
    .all(&ctx.db)
    .await?;

    // Collect unique categories (sorted)
    let mut seen_cats: HashSet<Option<String>> = HashSet::new();
    let mut all_categories: Vec<Option<String>> = Vec::new();
    for row in &rows {
        if seen_cats.insert(row.category_name.clone()) {
            all_categories.push(row.category_name.clone());
        }
    }
    all_categories.sort_by(|a, b| match (a, b) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, _) => std::cmp::Ordering::Greater,
        (_, None) => std::cmp::Ordering::Less,
        (Some(x), Some(y)) => x.cmp(y),
    });

    // Build pivot: dept → category → (count, value)
    let mut dept_order: Vec<Option<String>> = Vec::new();
    let mut dept_seen: HashSet<Option<String>> = HashSet::new();
    let mut pivot: HashMap<Option<String>, HashMap<Option<String>, (i64, i64)>> = HashMap::new();
    for row in rows {
        if dept_seen.insert(row.department_name.clone()) {
            dept_order.push(row.department_name.clone());
        }
        let e = pivot
            .entry(row.department_name)
            .or_default()
            .entry(row.category_name)
            .or_insert((0, 0));
        e.0 += row.asset_count;
        e.1 += row.total_appraised_value;
    }

    let dept_rows: Vec<DeptCategoryRow> = dept_order
        .into_iter()
        .map(|dept_name| {
            let cat_map = pivot.get(&dept_name).cloned().unwrap_or_default();
            let cells: Vec<CategoryCell> = all_categories
                .iter()
                .map(|cat| {
                    let (count, total) = cat_map.get(cat).copied().unwrap_or((0, 0));
                    CategoryCell { count, total }
                })
                .collect();
            let total_count = cells.iter().map(|c| c.count).sum();
            let total_value = cells.iter().map(|c| c.total).sum();
            DeptCategoryRow { department_name: dept_name, cells, total_count, total_value }
        })
        .collect();

    let col_totals: Vec<CategoryCell> = (0..all_categories.len())
        .map(|i| CategoryCell {
            count: dept_rows.iter().map(|r| r.cells[i].count).sum(),
            total: dept_rows.iter().map(|r| r.cells[i].total).sum(),
        })
        .collect();

    format::json(CategoryByDeptResponse {
        grand_total_count: dept_rows.iter().map(|r| r.total_count).sum(),
        grand_total_value: dept_rows.iter().map(|r| r.total_value).sum(),
        categories: all_categories,
        rows: dept_rows,
        col_totals,
    })
}

pub async fn serve_photo(Path(filename): Path<String>) -> impl IntoResponse {
    let safe_name = filename.replace("..", "").replace('/', "");
    let path = format!("uploads/photos/{}", safe_name);

    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let content_type = if safe_name.ends_with(".png") {
                "image/png"
            } else if safe_name.ends_with(".gif") {
                "image/gif"
            } else if safe_name.ends_with(".webp") {
                "image/webp"
            } else {
                "image/jpeg"
            };
            (
                axum::http::StatusCode::OK,
                [(header::CONTENT_TYPE, content_type)],
                bytes,
            )
                .into_response()
        }
        Err(_) => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/assets/")
        .add("public/{pid}", get(get_public))
        .add("public/{pid}/inspect", post(add_public_inspection))
        .add("photo/{filename}", get(serve_photo))
        .add("summary/department-values", get(dept_value_summary))
        .add("summary/category-by-department", get(category_by_dept_summary))
        .add("/", get(list))
        .add("/", post(add))
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
        .add("{pid}/photo", post(upload_photo))
        .add("{pid}/qr", get(get_qr))
        .add("{pid}/inspections", get(list_inspections))
        .add("{pid}/inspections", post(add_inspection))
}
