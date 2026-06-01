use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::inspection_templates::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct InspectionTemplateResponse {
    pub pid: Uuid,
    pub title: String,
    pub inspection_type: String,
    pub inspection_result: Option<String>,
    pub remarks: Option<String>,
    pub sort_order: i32,
}

impl From<Model> for InspectionTemplateResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            title: m.title,
            inspection_type: m.inspection_type,
            inspection_result: m.inspection_result,
            remarks: m.remarks,
            sort_order: m.sort_order,
        }
    }
}
