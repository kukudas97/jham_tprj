#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::inspection_templates::Model;
use crate::models::_entities::inspection_templates::ActiveModel;
use crate::models::users;
use crate::views::inspection_template::InspectionTemplateResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub title: String,
    #[serde(default = "default_inspection_type")]
    pub inspection_type: String,
    pub inspection_result: Option<String>,
    pub inspector_name: Option<String>,
    pub note: Option<String>,
    pub remarks: Option<String>,
    pub sort_order: Option<i32>,
}

fn default_inspection_type() -> String {
    "일반점검".to_string()
}

impl Params {
    fn update(&self, item: &mut ActiveModel) {
        item.title = Set(self.title.clone());
        item.inspection_type = Set(self.inspection_type.clone());
        item.inspection_result = Set(self.inspection_result.clone());
        item.inspector_name = Set(self.inspector_name.clone());
        item.note = Set(self.note.clone());
        item.remarks = Set(self.remarks.clone());
        item.sort_order = Set(self.sort_order.unwrap_or(0));
    }
}

async fn get_user_and_company(auth: &auth::JWT, ctx: &AppContext) -> Result<(i32, i32)> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let company_id = user
        .company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))?;
    Ok((user.id, company_id))
}

#[debug_handler]
pub async fn list(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let (user_id, company_id) = get_user_and_company(&auth, &ctx).await?;
    let items = Model::find_all_by_user(&ctx.db, company_id, user_id).await?;
    format::json(items.into_iter().map(InspectionTemplateResponse::from).collect::<Vec<_>>())
}

#[debug_handler]
pub async fn add(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let (user_id, company_id) = get_user_and_company(&auth, &ctx).await?;
    let mut item = ActiveModel { ..Default::default() };
    params.update(&mut item);
    item.company_id = Set(company_id);
    item.user_id = Set(user_id);
    let item = item.insert(&ctx.db).await?;
    format::json(InspectionTemplateResponse::from(item))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let (user_id, company_id) = get_user_and_company(&auth, &ctx).await?;
    let template = Model::find_by_pid(&ctx.db, &pid).await?;
    if template.company_id != company_id || template.user_id != user_id {
        return Err(Error::Unauthorized("접근 권한이 없습니다.".to_string()));
    }
    let mut item = template.into_active_model();
    params.update(&mut item);
    let item = item.update(&ctx.db).await?;
    format::json(InspectionTemplateResponse::from(item))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let (user_id, company_id) = get_user_and_company(&auth, &ctx).await?;
    let template = Model::find_by_pid(&ctx.db, &pid).await?;
    if template.company_id != company_id || template.user_id != user_id {
        return Err(Error::Unauthorized("접근 권한이 없습니다.".to_string()));
    }
    let mut item = template.into_active_model();
    item.deleted_at = Set(Some(chrono::Utc::now().into()));
    item.update(&ctx.db).await?;
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/inspection_templates/")
        .add("/", get(list))
        .add("/", post(add))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
        .add("{pid}", delete(remove))
}
