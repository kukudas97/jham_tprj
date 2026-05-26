use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_uploads::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetUploadResponse {
    pub pid: Uuid,
    pub filename: String,
    pub status: String,
    pub error_message: Option<String>,
}

impl From<Model> for AssetUploadResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            filename: m.filename,
            status: m.status,
            error_message: m.error_message,
        }
    }
}
