#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_inspections::Model;
use crate::models::_entities::asset_inspections::ActiveModel;
use crate::models::users;
use crate::views::asset_inspection::AssetInspectionResponse;

fn parse_date(s: &str) -> Option<chrono::NaiveDate> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
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

impl Params {
    fn update(&self, item: &mut ActiveModel) {
        item.inspector_name = Set(self.inspector_name.clone());
        item.note = Set(self.note.clone());
        item.inspection_type = Set(self.inspection_type.clone());
        item.inspection_result = Set(self.inspection_result.clone());
        item.inspection_date = Set(self.inspection_date.as_deref().and_then(parse_date));
        item.period_start = Set(self.period_start.as_deref().and_then(parse_date));
        item.period_end = Set(self.period_end.as_deref().and_then(parse_date));
        item.remarks = Set(self.remarks.clone());
    }
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

#[debug_handler]
pub async fn get_one(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let _company_id = get_company_id(&auth, &ctx).await?;
    let item = Model::find_by_pid(&ctx.db, &pid).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let _company_id = get_company_id(&auth, &ctx).await?;
    let inspection = Model::find_by_pid(&ctx.db, &pid).await?;
    let mut item = inspection.into_active_model();
    params.update(&mut item);
    let item = item.update(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let _company_id = get_company_id(&auth, &ctx).await?;
    let inspection = Model::find_by_pid(&ctx.db, &pid).await?;
    let mut item = inspection.into_active_model();
    item.deleted_at = Set(Some(chrono::Utc::now().into()));
    item.update(&ctx.db).await?;
    format::empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/asset_inspections/")
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
}
