#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::departments;
use crate::models::teams;
use crate::models::users;
use crate::services;
use crate::views::department::{DepartmentResponse, SyncResponse, TeamResponse};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeptParams {
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TeamParams {
    pub name: String,
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

// ─── 부서 목록 ────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn list_departments(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let depts = departments::Model::find_all_active_by_company(&ctx.db, company_id).await?;

    let mut responses: Vec<DepartmentResponse> = Vec::new();
    for dept in depts {
        let dept_teams =
            teams::Model::find_all_active_by_department(&ctx.db, dept.id).await?;
        responses.push(DepartmentResponse::new(dept, dept_teams));
    }

    format::json(responses)
}

// ─── 부서 생성 ────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn create_department(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<DeptParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err(Error::BadRequest("부서명을 입력해주세요.".to_string()));
    }

    // 중복 확인
    if departments::Model::find_by_name_and_company(&ctx.db, &name, company_id)
        .await?
        .is_some()
    {
        return Err(Error::BadRequest(format!("'{}' 부서가 이미 존재합니다.", name)));
    }

    let dept = departments::ActiveModel {
        company_id: Set(company_id),
        name: Set(name),
        deleted_at: Set(None),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    format::json(DepartmentResponse::new(dept, vec![]))
}

// ─── 부서 수정 ────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn update_department(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<DeptParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let dept = departments::Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err(Error::BadRequest("부서명을 입력해주세요.".to_string()));
    }

    // 이름 변경 시 중복 확인
    if dept.name != name {
        if departments::Model::find_by_name_and_company(&ctx.db, &name, company_id)
            .await?
            .is_some()
        {
            return Err(Error::BadRequest(format!("'{}' 부서가 이미 존재합니다.", name)));
        }
    }

    let mut active = dept.into_active_model();
    active.name = Set(name);
    let updated = active.update(&ctx.db).await?;

    let dept_teams =
        teams::Model::find_all_active_by_department(&ctx.db, updated.id).await?;
    format::json(DepartmentResponse::new(updated, dept_teams))
}

// ─── 부서 삭제 ────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn delete_department(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let dept = departments::Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    // 소속 팀도 같이 soft delete
    let dept_teams =
        teams::Model::find_all_active_by_department(&ctx.db, dept.id).await?;
    for team in dept_teams {
        let mut active = team.into_active_model();
        active.deleted_at = Set(Some(chrono::Utc::now().into()));
        active.update(&ctx.db).await?;
    }

    let mut active = dept.into_active_model();
    active.deleted_at = Set(Some(chrono::Utc::now().into()));
    active.update(&ctx.db).await?;

    format::empty()
}

// ─── 팀 생성 ─────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn create_team(
    auth: auth::JWT,
    Path(dept_pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<TeamParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let dept =
        departments::Model::find_by_pid_and_company(&ctx.db, &dept_pid, company_id).await?;

    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err(Error::BadRequest("팀명을 입력해주세요.".to_string()));
    }

    // 같은 부서 내 중복 확인
    if teams::Model::find_by_name_and_department(&ctx.db, &name, dept.id)
        .await?
        .is_some()
    {
        return Err(Error::BadRequest(format!("'{}' 팀이 이미 존재합니다.", name)));
    }

    let team = teams::ActiveModel {
        company_id: Set(company_id),
        department_id: Set(dept.id),
        name: Set(name),
        deleted_at: Set(None),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    format::json(TeamResponse { pid: team.pid, name: team.name })
}

// ─── 팀 수정 ─────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn update_team(
    auth: auth::JWT,
    Path((dept_pid, team_pid)): Path<(String, String)>,
    State(ctx): State<AppContext>,
    Json(params): Json<TeamParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let dept =
        departments::Model::find_by_pid_and_company(&ctx.db, &dept_pid, company_id).await?;
    let team = teams::Model::find_by_pid_and_company(&ctx.db, &team_pid, company_id).await?;

    let name = params.name.trim().to_string();
    if name.is_empty() {
        return Err(Error::BadRequest("팀명을 입력해주세요.".to_string()));
    }

    if team.name != name {
        if teams::Model::find_by_name_and_department(&ctx.db, &name, dept.id)
            .await?
            .is_some()
        {
            return Err(Error::BadRequest(format!("'{}' 팀이 이미 존재합니다.", name)));
        }
    }

    let team_uuid = team.pid;
    let mut active = team.into_active_model();
    active.name = Set(name.clone());
    active.update(&ctx.db).await?;

    format::json(TeamResponse { pid: team_uuid, name })
}

// ─── 팀 삭제 ─────────────────────────────────────────────────────────────
#[debug_handler]
pub async fn delete_team(
    auth: auth::JWT,
    Path((_dept_pid, team_pid)): Path<(String, String)>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let team = teams::Model::find_by_pid_and_company(&ctx.db, &team_pid, company_id).await?;

    let mut active = team.into_active_model();
    active.deleted_at = Set(Some(chrono::Utc::now().into()));
    active.update(&ctx.db).await?;

    format::empty()
}

// ─── 기존 자산 부서/팀 자동 매핑 ─────────────────────────────────────────
#[debug_handler]
pub async fn sync_from_assets(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let updated = services::department::sync_assets_to_departments(&ctx.db, company_id)
        .await
        .map_err(|e| Error::Message(e))?;

    format::json(SyncResponse { updated })
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/departments")
        .add("/", get(list_departments))
        .add("/", post(create_department))
        .add("/sync", post(sync_from_assets))
        .add("/{pid}", put(update_department))
        .add("/{pid}", delete(delete_department))
        .add("/{dept_pid}/teams", post(create_team))
        .add("/{dept_pid}/teams/{team_pid}", put(update_team))
        .add("/{dept_pid}/teams/{team_pid}", delete(delete_team))
}
