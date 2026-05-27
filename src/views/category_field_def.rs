use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::category_field_defs::Model;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FieldDefResponse {
    pub pid: Uuid,
    pub field_name: String,
    pub field_label: String,
    pub is_required: bool,
    pub sort_order: i32,
}

impl From<Model> for FieldDefResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            field_name: m.field_name,
            field_label: m.field_label,
            is_required: m.is_required,
            sort_order: m.sort_order,
        }
    }
}
