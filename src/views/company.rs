use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::_entities::companies::Model;

#[derive(Debug, Serialize, Deserialize)]
pub struct CompanyResponse {
    pub pid: Uuid,
    pub name: String,
}

impl From<Model> for CompanyResponse {
    fn from(m: Model) -> Self {
        Self {
            pid: m.pid,
            name: m.name,
        }
    }
}
