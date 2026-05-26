use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_inspections::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetInspectionResponse {
    pub pid: Uuid,
    pub inspector_name: String,
    pub note: Option<String>,
}

impl From<Model> for AssetInspectionResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            inspector_name: m.inspector_name,
            note: m.note,
        }
    }
}
