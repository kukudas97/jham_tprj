use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::assets::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetResponse {
    pub pid: Uuid,
    pub name: String,
    pub serial_number: Option<String>,
    pub location: Option<String>,
    pub note: Option<String>,
}

impl From<Model> for AssetResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            name: m.name,
            serial_number: m.serial_number,
            location: m.location,
            note: m.note,
        }
    }
}
