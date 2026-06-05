use sea_orm::{DatabaseConnection, FromQueryResult, Statement};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, FromQueryResult)]
pub struct AdminCompanyItem {
    pub pid: String,
    pub name: String,
    pub user_count: i64,
    pub created_at: String,
}

impl AdminCompanyItem {
    pub async fn load_all(db: &DatabaseConnection) -> Result<Vec<Self>, sea_orm::DbErr> {
        Self::find_by_statement(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"
                SELECT c.pid::text AS pid,
                       c.name,
                       COUNT(u.id) AS user_count,
                       c.created_at::text AS created_at
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                GROUP BY c.id, c.pid, c.name, c.created_at
                ORDER BY c.name
            "#,
            [],
        ))
        .all(db)
        .await
    }
}

#[derive(Debug, Serialize, Deserialize, FromQueryResult)]
pub struct AdminUserItem {
    pub pid: String,
    pub name: String,
    pub email: String,
    pub is_admin: bool,
    pub company_pid: Option<String>,
    pub company_name: Option<String>,
    pub created_at: String,
}

impl AdminUserItem {
    pub async fn load_all(db: &DatabaseConnection) -> Result<Vec<Self>, sea_orm::DbErr> {
        Self::find_by_statement(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"
                SELECT u.pid::text AS pid,
                       u.name,
                       u.email,
                       u.is_admin,
                       c.pid::text AS company_pid,
                       c.name AS company_name,
                       u.created_at::text AS created_at
                FROM users u
                LEFT JOIN companies c ON c.id = u.company_id
                ORDER BY u.name
            "#,
            [],
        ))
        .all(db)
        .await
    }
}
