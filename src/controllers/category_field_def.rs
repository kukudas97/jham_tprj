#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_categories;
use crate::models::category_field_defs::Model;
use crate::models::_entities::category_field_defs::ActiveModel;
use crate::models::users;
use crate::views::category_field_def::FieldDefResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateFieldParams {
    pub field_name: String,
    pub field_label: String,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub sort_order: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateFieldParams {
    pub field_name: String,
    pub field_label: String,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub sort_order: i32,
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

#[debug_handler]
pub async fn list(
    auth: auth::JWT,
    Path(cat_pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let cat = asset_categories::Model::find_by_pid_and_company(&ctx.db, &cat_pid, company_id).await?;
    let defs = Model::find_by_category(&ctx.db, cat.id).await?;
    format::json(defs.into_iter().map(FieldDefResponse::from).collect::<Vec<_>>())
}

#[debug_handler]
pub async fn create(
    auth: auth::JWT,
    Path(cat_pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<CreateFieldParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let cat = asset_categories::Model::find_by_pid_and_company(&ctx.db, &cat_pid, company_id).await?;

    if cat.parent_id.is_some() {
        return Err(Error::BadRequest("소분류에는 커스텀 필드를 추가할 수 없습니다.".to_string()));
    }

    if params.field_name.trim().is_empty() || params.field_label.trim().is_empty() {
        return Err(Error::BadRequest("field_name과 field_label은 필수입니다.".to_string()));
    }

    let item = ActiveModel {
        category_id: Set(cat.id),
        company_id: Set(company_id),
        field_name: Set(params.field_name.trim().to_string()),
        field_label: Set(params.field_label.trim().to_string()),
        is_required: Set(params.is_required),
        sort_order: Set(params.sort_order),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    format::json(FieldDefResponse::from(item))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path((cat_pid, field_pid)): Path<(String, String)>,
    State(ctx): State<AppContext>,
    Json(params): Json<UpdateFieldParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    // verify category ownership
    asset_categories::Model::find_by_pid_and_company(&ctx.db, &cat_pid, company_id).await?;

    let def = Model::find_by_pid_and_company(&ctx.db, &field_pid, company_id).await?;
    let mut active = def.into_active_model();
    active.field_name = Set(params.field_name.trim().to_string());
    active.field_label = Set(params.field_label.trim().to_string());
    active.is_required = Set(params.is_required);
    active.sort_order = Set(params.sort_order);
    let updated = active.update(&ctx.db).await?;
    format::json(FieldDefResponse::from(updated))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path((cat_pid, field_pid)): Path<(String, String)>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    asset_categories::Model::find_by_pid_and_company(&ctx.db, &cat_pid, company_id).await?;

    let def = Model::find_by_pid_and_company(&ctx.db, &field_pid, company_id).await?;
    def.into_active_model().delete(&ctx.db).await?;
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/categories/")
        .add("{cat_pid}/fields", get(list))
        .add("{cat_pid}/fields", post(create))
        .add("{cat_pid}/fields/{field_pid}", put(update))
        .add("{cat_pid}/fields/{field_pid}", delete(remove))
}
