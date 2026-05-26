#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::{_entities::companies::ActiveModel, companies::Model};
use crate::views::company::CompanyResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub name: String,
}

impl Params {
    fn update(&self, item: &mut ActiveModel) {
        item.name = Set(self.name.clone());
    }
}

#[debug_handler]
pub async fn list(State(ctx): State<AppContext>) -> Result<Response> {
    let items = Model::find_all(&ctx.db).await?;
    format::json(items.into_iter().map(CompanyResponse::from).collect::<Vec<_>>())
}

#[debug_handler]
pub async fn add(State(ctx): State<AppContext>, Json(params): Json<Params>) -> Result<Response> {
    let mut item = ActiveModel {
        ..Default::default()
    };
    params.update(&mut item);
    let item = item.insert(&ctx.db).await?;
    format::json(CompanyResponse::from(item))
}

#[debug_handler]
pub async fn update(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let item = Model::find_by_pid(&ctx.db, &pid).await?;
    let mut item = item.into_active_model();
    params.update(&mut item);
    let item = item.update(&ctx.db).await?;
    format::json(CompanyResponse::from(item))
}

#[debug_handler]
pub async fn remove(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    Model::find_by_pid(&ctx.db, &pid).await?.delete(&ctx.db).await?;
    format::empty()
}

#[debug_handler]
pub async fn get_one(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    let item = Model::find_by_pid(&ctx.db, &pid).await?;
    format::json(CompanyResponse::from(item))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/companies/")
        .add("/", get(list))
        .add("/", post(add))
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
}
