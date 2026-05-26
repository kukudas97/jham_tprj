#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_inspections::Model;
use crate::models::_entities::asset_inspections::ActiveModel;
use crate::views::asset_inspection::AssetInspectionResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub asset_id: i32,
    pub inspector_name: String,
    pub note: Option<String>,
}

impl Params {
    fn update(&self, item: &mut ActiveModel) {
        item.asset_id = Set(self.asset_id);
        item.inspector_name = Set(self.inspector_name.clone());
        item.note = Set(self.note.clone());
    }
}

#[debug_handler]
pub async fn list(State(ctx): State<AppContext>, Json(params): Json<Params>) -> Result<Response> {
    let items = Model::find_all_by_asset(&ctx.db, params.asset_id).await?;
    format::json(items.into_iter().map(AssetInspectionResponse::from).collect::<Vec<_>>())
}

#[debug_handler]
pub async fn add(State(ctx): State<AppContext>, Json(params): Json<Params>) -> Result<Response> {
    let mut item = ActiveModel {
        ..Default::default()
    };
    params.update(&mut item);
    let item = item.insert(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn update(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let inspection = Model::find_by_pid(&ctx.db, &pid).await?;
    let mut item = inspection.into_active_model();
    params.update(&mut item);
    let item = item.update(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn remove(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    Model::find_by_pid(&ctx.db, &pid).await?.delete(&ctx.db).await?;
    format::empty()
}

#[debug_handler]
pub async fn get_one(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    let item = Model::find_by_pid(&ctx.db, &pid).await?;
    format::json(AssetInspectionResponse::from(item))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/asset_inspections/")
        .add("/", get(list))
        .add("/", post(add))
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
}
