use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::departments::Model as DeptModel;
use crate::models::_entities::teams::Model as TeamModel;

#[derive(Debug, Serialize, Deserialize)]
pub struct TeamResponse {
    pub pid: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepartmentResponse {
    pub pid: Uuid,
    pub name: String,
    pub teams: Vec<TeamResponse>,
}

impl DepartmentResponse {
    pub fn new(dept: DeptModel, teams: Vec<TeamModel>) -> Self {
        Self {
            pid: dept.pid,
            name: dept.name,
            teams: teams.into_iter().map(|t| TeamResponse { pid: t.pid, name: t.name }).collect(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub updated: usize,
}
