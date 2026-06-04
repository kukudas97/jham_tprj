use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_categories;
use crate::models::_entities::assets::Model;
use crate::models::_entities::departments;
use crate::models::_entities::teams;

// ─── Summary response types ───────────────────────────────────────────────────

// Image 1: 부서/팀 행 × 자산분류 열 (평가금액)
#[derive(Debug, Serialize)]
pub struct TeamCatEntry {
    pub team_name: Option<String>,
    pub values: Vec<i64>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct DeptCatEntry {
    pub department_name: Option<String>,
    pub subtotal: Vec<i64>,
    pub grand_total: i64,
    pub teams: Vec<TeamCatEntry>,
}

#[derive(Debug, Serialize)]
pub struct DeptTeamCategoryResponse {
    pub categories: Vec<Option<String>>,
    pub departments: Vec<DeptCatEntry>,
    pub grand_subtotal: Vec<i64>,
    pub grand_total: i64,
}

// Image 2: 대분류 > 세부분류 행 × 부서 열 (수량)
#[derive(Debug, Serialize)]
pub struct CatChildEntry {
    pub name: Option<String>,
    pub counts: Vec<i64>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct CatGroupEntry {
    pub parent_name: Option<String>,
    pub children: Vec<CatChildEntry>,
    pub subtotal: Vec<i64>,
    pub grand_total: i64,
}

#[derive(Debug, Serialize)]
pub struct CategoryDeptCountResponse {
    pub departments: Vec<Option<String>>,
    pub categories: Vec<CatGroupEntry>,
    pub grand_subtotal: Vec<i64>,
    pub grand_total: i64,
}

// ─── Legacy summary types (기존 endpoint 호환) ────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TeamValueSummary {
    pub team_name: Option<String>,
    pub asset_count: i64,
    pub total_appraised_value: i64,
}

#[derive(Debug, Serialize)]
pub struct DepartmentValueSummary {
    pub department_name: Option<String>,
    pub asset_count: i64,
    pub total_appraised_value: i64,
    pub teams: Vec<TeamValueSummary>,
}

#[derive(Debug, Serialize, Clone, Copy)]
pub struct CategoryCell {
    pub count: i64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct DeptCategoryRow {
    pub department_name: Option<String>,
    pub cells: Vec<CategoryCell>,
    pub total_count: i64,
    pub total_value: i64,
}

#[derive(Debug, Serialize)]
pub struct CategoryByDeptResponse {
    pub categories: Vec<Option<String>>,
    pub rows: Vec<DeptCategoryRow>,
    pub col_totals: Vec<CategoryCell>,
    pub grand_total_count: i64,
    pub grand_total_value: i64,
}

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
