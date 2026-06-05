use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_categories::Model;
use crate::views::category_field_def::FieldDefResponse;

#[derive(Debug, Serialize, Deserialize)]
pub struct RequiredFields {
    pub serial_number: bool,
    pub location: bool,
    pub note: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubCategoryResponse {
    pub pid: Uuid,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryResponse {
    pub pid: Uuid,
    pub name: String,
    pub sort_order: i32,
    pub children: Vec<SubCategoryResponse>,
    pub required_fields: RequiredFields,
    pub field_defs: Vec<FieldDefResponse>,
}

impl CategoryResponse {
    pub fn new(parent: Model, children: Vec<Model>, field_defs: Vec<FieldDefResponse>) -> Self {
        Self {
            pid: parent.pid,
            name: parent.name,
            sort_order: parent.sort_order,
            required_fields: RequiredFields {
                serial_number: parent.require_serial_number,
                location: parent.require_location,
                note: parent.require_note,
            },
            children: children
                .into_iter()
                .map(|c| SubCategoryResponse { pid: c.pid, name: c.name, sort_order: c.sort_order })
                .collect(),
            field_defs,
        }
    }
}
