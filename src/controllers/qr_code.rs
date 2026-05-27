#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use axum::http::header;
use axum::response::IntoResponse;
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::qr_codes::Model;
use crate::models::_entities::qr_codes::ActiveModel;
use crate::models::assets;
use crate::services;
use crate::views::qr_code::QrCodeResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub asset_id: i32,
}

#[debug_handler]
pub async fn add(State(ctx): State<AppContext>, Json(params): Json<Params>) -> Result<Response> {
    let asset = assets::Entity::find_by_id(params.asset_id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let base_url = ctx.config.server.full_url();
    let image_path = services::qr_code::generate(&asset.pid.to_string(), &base_url)
        .map_err(|e| Error::Message(e.to_string()))?;

    let mut item = ActiveModel {
        ..Default::default()
    };
    item.asset_id = Set(params.asset_id);
    item.image_path = Set(image_path);
    let item = item.insert(&ctx.db).await?;
    format::json(QrCodeResponse::from(item))
}

#[debug_handler]
pub async fn get_one(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    let item = Model::find_by_pid(&ctx.db, &pid).await?;
    format::json(QrCodeResponse::from(item))
}

#[debug_handler]
pub async fn remove(Path(pid): Path<String>, State(ctx): State<AppContext>) -> Result<Response> {
    Model::find_by_pid(&ctx.db, &pid).await?.delete(&ctx.db).await?;
    format::empty()
}

pub async fn get_image(Path(filename): Path<String>) -> impl IntoResponse {
    let safe_name = filename.replace("..", "").replace('/', "");
    let path = format!("qr/{}", safe_name);

    match tokio::fs::read(&path).await {
        Ok(bytes) => (
            axum::http::StatusCode::OK,
            [(header::CONTENT_TYPE, "image/png")],
            bytes,
        )
            .into_response(),
        Err(_) => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/qr_codes/")
        .add("/", post(add))
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("image/{filename}", get(get_image))
}
