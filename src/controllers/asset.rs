#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unnecessary_struct_initialization)]
#![allow(clippy::unused_async)]
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::asset_inspections;
use crate::models::assets::Model;
use crate::models::_entities::assets::ActiveModel;
use crate::models::qr_codes;
use crate::models::users;
use crate::services;
use crate::views::asset::AssetResponse;
use crate::views::asset_inspection::AssetInspectionResponse;
use crate::views::qr_code::QrCodeResponse;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub name: String,
    pub serial_number: Option<String>,
    pub location: Option<String>,
    pub note: Option<String>,
}

impl Params {
    fn update(&self, item: &mut ActiveModel) {
        item.name = Set(self.name.clone());
        item.serial_number = Set(self.serial_number.clone());
        item.location = Set(self.location.clone());
        item.note = Set(self.note.clone());
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InspectionParams {
    pub inspector_name: String,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetPublicResponse {
    pub pid: String,
    pub name: String,
    pub serial_number: Option<String>,
    pub location: Option<String>,
    pub note: Option<String>,
}

async fn get_company_id(auth: &auth::JWT, ctx: &AppContext) -> Result<i32> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    user.company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))
}

#[debug_handler]
pub async fn list(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let items = Model::find_all_by_company(&ctx.db, company_id).await?;
    format::json(items.into_iter().map(AssetResponse::from).collect::<Vec<_>>())
}

#[debug_handler]
pub async fn add(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let mut item = ActiveModel {
        ..Default::default()
    };
    params.update(&mut item);
    item.company_id = Set(company_id);
    let item = item.insert(&ctx.db).await?;

    let image_path = services::qr_code::generate(&item.pid.to_string())
        .map_err(|e| Error::Message(e.to_string()))?;
    qr_codes::ActiveModel {
        asset_id: Set(item.id),
        image_path: Set(image_path),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    format::json(AssetResponse::from(item))
}

#[debug_handler]
pub async fn update(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<Params>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let mut item = asset.into_active_model();
    params.update(&mut item);
    let item = item.update(&ctx.db).await?;
    format::json(AssetResponse::from(item))
}

#[debug_handler]
pub async fn remove(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let mut item = asset.into_active_model();
    item.deleted_at = Set(Some(chrono::Utc::now().into()));
    item.update(&ctx.db).await?;
    format::empty()
}

#[debug_handler]
pub async fn get_one(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let item = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    format::json(AssetResponse::from(item))
}

#[debug_handler]
pub async fn get_public(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let asset = Model::find_by_pid(&ctx.db, &pid).await?;
    format::json(AssetPublicResponse {
        pid: asset.pid.to_string(),
        name: asset.name,
        serial_number: asset.serial_number,
        location: asset.location,
        note: asset.note,
    })
}

#[debug_handler]
pub async fn add_public_inspection(
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<InspectionParams>,
) -> Result<Response> {
    let asset = Model::find_by_pid(&ctx.db, &pid).await?;
    let mut item = asset_inspections::ActiveModel {
        ..Default::default()
    };
    item.asset_id = Set(asset.id);
    item.inspector_name = Set(params.inspector_name);
    item.note = Set(params.note);
    let item = item.insert(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

#[debug_handler]
pub async fn get_qr(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;

    let qr = qr_codes::Model::find_by_asset(&ctx.db, asset.id).await?;
    let qr = match qr {
        Some(q) => q,
        None => {
            let image_path = services::qr_code::generate(&asset.pid.to_string())
                .map_err(|e| Error::Message(e.to_string()))?;
            qr_codes::ActiveModel {
                asset_id: Set(asset.id),
                image_path: Set(image_path),
                ..Default::default()
            }
            .insert(&ctx.db)
            .await?
        }
    };

    format::json(QrCodeResponse::from(qr))
}

#[debug_handler]
pub async fn list_inspections(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let items = asset_inspections::Model::find_all_by_asset(&ctx.db, asset.id).await?;
    format::json(
        items
            .into_iter()
            .map(AssetInspectionResponse::from)
            .collect::<Vec<_>>(),
    )
}

#[debug_handler]
pub async fn add_inspection(
    auth: auth::JWT,
    Path(pid): Path<String>,
    State(ctx): State<AppContext>,
    Json(params): Json<InspectionParams>,
) -> Result<Response> {
    let company_id = get_company_id(&auth, &ctx).await?;
    let asset = Model::find_by_pid_and_company(&ctx.db, &pid, company_id).await?;
    let mut item = asset_inspections::ActiveModel {
        ..Default::default()
    };
    item.asset_id = Set(asset.id);
    item.inspector_name = Set(params.inspector_name);
    item.note = Set(params.note);
    let item = item.insert(&ctx.db).await?;
    format::json(AssetInspectionResponse::from(item))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/assets/")
        .add("public/{pid}", get(get_public))
        .add("public/{pid}/inspect", post(add_public_inspection))
        .add("/", get(list))
        .add("/", post(add))
        .add("{pid}", get(get_one))
        .add("{pid}", delete(remove))
        .add("{pid}", put(update))
        .add("{pid}", patch(update))
        .add("{pid}/qr", get(get_qr))
        .add("{pid}/inspections", get(list_inspections))
        .add("{pid}/inspections", post(add_inspection))
}
