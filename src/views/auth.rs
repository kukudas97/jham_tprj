use serde::{Deserialize, Serialize};

use crate::models::_entities::users;

#[derive(Debug, Deserialize, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub pid: String,
    pub name: String,
    pub is_verified: bool,
    pub company_id: Option<i32>,
    pub company_pid: Option<String>,
}

impl LoginResponse {
    #[must_use]
    pub fn new(user: &users::Model, token: &String, company_pid: Option<String>) -> Self {
        Self {
            token: token.to_string(),
            pid: user.pid.to_string(),
            name: user.name.clone(),
            is_verified: user.email_verified_at.is_some(),
            company_id: user.company_id,
            company_pid,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CurrentResponse {
    pub pid: String,
    pub name: String,
    pub email: String,
    pub company_id: Option<i32>,
    pub company_pid: Option<String>,
}

impl CurrentResponse {
    #[must_use]
    pub fn new(user: &users::Model, company_pid: Option<String>) -> Self {
        Self {
            pid: user.pid.to_string(),
            name: user.name.clone(),
            email: user.email.clone(),
            company_id: user.company_id,
            company_pid,
        }
    }
}
