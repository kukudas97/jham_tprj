use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_categories;
use crate::models::_entities::assets::Model;
use crate::models::_entities::departments;
use crate::models::_entities::teams;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FieldValueResponse {
    pub field_def_pid: Uuid,
    pub field_name: String,
    pub field_label: String,
    pub value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetResponse {
    pub pid: Uuid,
    pub name: String,
    pub serial_number: String,
    pub location: Option<String>,
    pub note: Option<String>,
    pub category_pid: Option<Uuid>,
    pub category_name: Option<String>,
    pub department_pid: Option<Uuid>,
    pub department_name: Option<String>,
    pub team_pid: Option<Uuid>,
    pub team_name: Option<String>,
    pub manager_name: Option<String>,
    pub appraised_value: i64,
    pub field_values: Vec<FieldValueResponse>,
    pub photo_url: Option<String>,
}

impl AssetResponse {
    pub fn new(
        asset: Model,
        category: Option<&asset_categories::Model>,
        department: Option<&departments::Model>,
        team: Option<&teams::Model>,
        field_values: Vec<FieldValueResponse>,
    ) -> Self {
        let photo_url = asset.photo_path.as_deref().map(|p| {
            let filename = std::path::Path::new(p)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            format!("/api/assets/photo/{}", filename)
        });
        Self {
            pid: asset.pid,
            name: asset.name,
            serial_number: asset.serial_number,
            location: asset.location,
            note: asset.note,
            category_pid: category.map(|c| c.pid),
            category_name: category.map(|c| c.name.clone()),
            department_pid: department.map(|d| d.pid),
            department_name: department.map(|d| d.name.clone()),
            team_pid: team.map(|t| t.pid),
            team_name: team.map(|t| t.name.clone()),
            manager_name: asset.manager_name,
            appraised_value: asset.appraised_value,
            field_values,
            photo_url,
        }
    }
}
