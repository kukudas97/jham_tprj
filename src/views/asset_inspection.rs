use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::asset_inspections::Model;
use crate::models::asset_inspections::InspectionWithAsset;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetInspectionResponse {
    pub pid: Uuid,
    pub inspector_name: String,
    pub note: Option<String>,
    pub inspection_type: String,
    pub inspection_result: Option<String>,
    pub inspection_date: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
    pub remarks: Option<String>,
    pub created_at: String,
}

impl From<Model> for AssetInspectionResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            inspector_name: m.inspector_name,
            note: m.note,
            inspection_type: m.inspection_type,
            inspection_result: m.inspection_result,
            inspection_date: m.inspection_date.map(|d| d.to_string()),
            period_start: m.period_start.map(|d| d.to_string()),
            period_end: m.period_end.map(|d| d.to_string()),
            remarks: m.remarks,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InspectionListResponse {
    pub pid: Uuid,
    pub inspector_name: String,
    pub note: Option<String>,
    pub inspection_type: String,
    pub inspection_result: Option<String>,
    pub inspection_date: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
    pub remarks: Option<String>,
    pub created_at: String,
    pub asset_pid: Option<String>,
    pub asset_name: Option<String>,
    pub asset_serial_number: Option<String>,
    pub department_name: Option<String>,
    pub team_name: Option<String>,
}

impl From<InspectionWithAsset> for InspectionListResponse {
    fn from(iwa: InspectionWithAsset) -> Self {
        let ins = iwa.inspection;
        let asset = iwa.asset;
        Self {
            pid: ins.pid,
            inspector_name: ins.inspector_name,
            note: ins.note,
            inspection_type: ins.inspection_type,
            inspection_result: ins.inspection_result,
            inspection_date: ins.inspection_date.map(|d| d.to_string()),
            period_start: ins.period_start.map(|d| d.to_string()),
            period_end: ins.period_end.map(|d| d.to_string()),
            remarks: ins.remarks,
            created_at: ins.created_at.to_rfc3339(),
            asset_pid: asset.as_ref().map(|a| a.pid.to_string()),
            asset_name: asset.as_ref().map(|a| a.name.clone()),
            asset_serial_number: asset.as_ref().map(|a| a.serial_number.clone()),
            department_name: iwa.department_name,
            team_name: iwa.team_name,
        }
    }
}
