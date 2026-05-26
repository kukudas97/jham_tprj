use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::qr_codes::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct QrCodeResponse {
    pub pid: Uuid,
    pub image_path: String,
}

impl From<Model> for QrCodeResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            image_path: m.image_path,
        }
    }
}
