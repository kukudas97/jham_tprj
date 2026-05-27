#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_categories::{self, Model};
use crate::models::category_field_defs;
use crate::models::users;
use crate::views::asset_category::CategoryResponse;
use crate::views::category_field_def::FieldDefResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateParams {
    pub name: String,
    pub parent_pid: Option<String>,
    #[serde(default)]
    pub require_serial_number: bool,
    #[serde(default)]
    pub require_location: bool,
    #[serde(default)]
    pub require_note: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateParams {
    pub name: String,
    #[serde(default)]
    pub require_serial_number: bool,
    #[serde(default)]
    pub require_location: bool,
    #[serde(default)]
    pub require_note: bool,
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

#[debug_handler]
pub async fn list(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let all = Model::find_all_by_company(&ctx.db, company_id).await?;
    let all_defs = category_field_defs::Model::find_by_company(&ctx.db, company_id).await?;

    let (parents, children): (Vec<_>, Vec<_>) = all.into_iter().partition(|c| c.parent_id.is_none());

    // build a map: category_id → Vec<FieldDefResponse>
    let mut defs_map: std::collections::HashMap<i32, Vec<FieldDefResponse>> =
        std::collections::HashMap::new();
    for def in all_defs {
        defs_map
            .entry(def.category_id)
            .or_default()
            .push(FieldDefResponse::from(def));
    }

    let responses: Vec<CategoryResponse> = parents
        .into_iter()
        .map(|parent| {
            let kids: Vec<_> = children
                .iter()
                .filter(|c| c.parent_id == Some(parent.id))
                .cloned()
                .collect();
            let field_defs = defs_map.remove(&parent.id).unwrap_or_default();
            CategoryResponse::new(parent, kids, field_defs)
        })
        .collect();

    format::json(responses)
}

#[debug_handler]
pub async fn create(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<CreateParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;

    let parent_id = if let Some(pid) = &params.parent_pid {
        let parent = Model::find_by_pid_and_company(&ctx.db, pid, company_id).await?;
        if parent.parent_id.is_some() {
            return Err(Error::BadRequest("소분류 아래에 분류를 추가할 수 없습니다.".to_string()));
        }
        Some(parent.id)
    } else {
        None
    };

    let is_parent = parent_id.is_none();

    let item = asset_categories::ActiveModel {
        name: Set(params.name),
        parent_id: Set(parent_id),
        company_id: Set(company_id),
        require_serial_number: Set(if is_parent { params.require_serial_number } else { false }),
        require_location: Set(if is_parent { params.require_location } else { false }),
        require_note: Set(if is_parent { params.require_note } else { false }),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    format::json(CategoryResponse::new(item, vec![], vec![]))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<UpdateParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let item = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let is_parent = item.parent_id.is_none();
    let item_id = item.id;
    let mut active = item.into_active_model();
    active.name = Set(params.name);
    if is_parent {
        active.require_serial_number = Set(params.require_serial_number);
        active.require_location = Set(params.require_location);
        active.require_note = Set(params.require_note);
    }
    let updated = active.update(&ctx.db).await?;
    let children = Model::find_children(&ctx.db, updated.id).await?;
    let field_defs = if is_parent {
        category_field_defs::Model::find_by_category(&ctx.db, item_id)
            .await?
            .into_iter()
            .map(FieldDefResponse::from)
            .collect()
    } else {
        vec![]
    };
    format::json(CategoryResponse::new(updated, children, field_defs))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let item = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    if item.parent_id.is_none() {
        let children = Model::find_children(&ctx.db, item.id).await?;
        for child in children {
            child.into_active_model().delete(&ctx.db).await?;
        }
    }

    item.into_active_model().delete(&ctx.db).await?;
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/categories/")
        .add("/", get(list))
        .add("/", post(create))
        .add("{pid}", put(update))
        .add("{pid}", delete(remove))
}
