use loco_rs::prelude::*;
use sea_orm::{ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::{companies, users};
use crate::views::admin::{AdminCompanyItem, AdminUserItem};

#[derive(Debug, Deserialize, Serialize)]
struct SetAdminParams {
    is_admin: bool,
}

async fn check_admin(ctx: &AppContext, auth: &auth::JWT) -> Result<()> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    if !user.is_admin {
        return unauthorized("관리자 권한이 필요합니다.");
    }
    Ok(())
}

#[debug_handler]
async fn list_companies(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    check_admin(&ctx, &auth).await?;
    let items = AdminCompanyItem::load_all(&ctx.db).await?;
    format::json(items)
}

#[debug_handler]
async fn delete_company(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(pid): Path<String>,
) -> Result<Response> {
    check_admin(&ctx, &auth).await?;

    let uuid = Uuid::parse_str(&pid).map_err(|_| Error::NotFound)?;
    let company = companies::Entity::find()
        .filter(companies::Column::Pid.eq(uuid))
        .one(&ctx.db)
        .await?
        .ok_or(Error::NotFound)?;

    // Unassign users from this company before deleting
    for user in users::Entity::find()
        .filter(users::Column::CompanyId.eq(company.id))
        .all(&ctx.db)
        .await?
    {
        let mut am = user.into_active_model();
        am.company_id = ActiveValue::Set(None);
        am.update(&ctx.db).await?;
    }

    company.delete(&ctx.db).await?;
    format::empty()
}

#[debug_handler]
async fn list_users(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    check_admin(&ctx, &auth).await?;
    let items = AdminUserItem::load_all(&ctx.db).await?;
    format::json(items)
}

#[debug_handler]
async fn set_user_admin(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(pid): Path<String>,
    Json(params): Json<SetAdminParams>,
) -> Result<Response> {
    check_admin(&ctx, &auth).await?;

    let uuid = Uuid::parse_str(&pid).map_err(|_| Error::NotFound)?;
    let user = users::Entity::find()
        .filter(users::Column::Pid.eq(uuid))
        .one(&ctx.db)
        .await?
        .ok_or(Error::NotFound)?;

    let mut am = user.into_active_model();
    am.is_admin = ActiveValue::Set(params.is_admin);
    am.update(&ctx.db).await?;

    format::empty()
}

#[debug_handler]
async fn delete_user(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(pid): Path<String>,
) -> Result<Response> {
    check_admin(&ctx, &auth).await?;

    let uuid = Uuid::parse_str(&pid).map_err(|_| Error::NotFound)?;

    // Prevent self-deletion
    let caller = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    if caller.pid == uuid {
        return bad_request("자기 자신을 삭제할 수 없습니다.");
    }

    let user = users::Entity::find()
        .filter(users::Column::Pid.eq(uuid))
        .one(&ctx.db)
        .await?
        .ok_or(Error::NotFound)?;

    user.delete(&ctx.db).await?;
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/admin")
        .add("/companies", get(list_companies))
        .add("/companies/{pid}", delete(delete_company))
        .add("/users", get(list_users))
        .add("/users/{pid}/is-admin", patch(set_user_admin))
        .add("/users/{pid}", delete(delete_user))
}
