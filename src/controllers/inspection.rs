#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_inspections::Model;
use crate::models::users;
use crate::views::asset_inspection::InspectionListResponse;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ListQuery {
    pub asset_name: Option<String>,
    pub department_pid: Option<String>,
    pub team_pid: Option<String>,
    pub inspection_type: Option<String>,
    pub inspection_result: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

fn parse_date(s: &str) -> Option<chrono::NaiveDate> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

#[debug_handler]
pub async fn list(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    axum::extract::Query(query): axum::extract::Query<ListQuery>,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let company_id = user
        .company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))?;

    let date_from = query.date_from.as_deref().and_then(parse_date);
    let date_to = query.date_to.as_deref().and_then(parse_date);

    let items = Model::find_all_by_company(
        &ctx.db,
        company_id,
        query.asset_name.as_deref(),
        query.department_pid.as_deref(),
        query.team_pid.as_deref(),
        query.inspection_type.as_deref(),
        query.inspection_result.as_deref(),
        date_from,
        date_to,
    )
    .await?;

    format::json(
        items.into_iter().map(InspectionListResponse::from).collect::<Vec<_>>(),
    )
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/inspections/")
        .add("/", get(list))
}
