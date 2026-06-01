use loco_rs::prelude::*;
use sea_orm::ColumnTrait;
use uuid::Uuid;

pub use super::_entities::teams::{self, ActiveModel, Entity, Model};

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if insert {
            let mut this = self;
            this.pid = ActiveValue::Set(Uuid::new_v4());
            this.created_at = ActiveValue::Set(chrono::Utc::now().into());
            this.updated_at = ActiveValue::Set(chrono::Utc::now().into());
            Ok(this)
        } else {
            let mut this = self;
            if this.updated_at.is_unchanged() {
                this.updated_at = ActiveValue::Set(chrono::Utc::now().into());
            }
            Ok(this)
        }
    }
}

impl Model {
    pub async fn find_all_active_by_company(
        db: &DatabaseConnection,
        company_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(teams::Entity::find()
            .filter(teams::Column::CompanyId.eq(company_id))
            .filter(teams::Column::DeletedAt.is_null())
            .all(db)
            .await?)
    }

    pub async fn find_all_active_by_department(
        db: &DatabaseConnection,
        department_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(teams::Entity::find()
            .filter(teams::Column::DepartmentId.eq(department_id))
            .filter(teams::Column::DeletedAt.is_null())
            .all(db)
            .await?)
    }

    pub async fn find_by_pid_and_company(
        db: &DatabaseConnection,
        pid: &str,
        company_id: i32,
    ) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = teams::Entity::find()
            .filter(teams::Column::Pid.eq(uuid))
            .filter(teams::Column::CompanyId.eq(company_id))
            .filter(teams::Column::DeletedAt.is_null())
            .one(db)
            .await?;
        item.ok_or(ModelError::EntityNotFound)
    }

    pub async fn find_by_name_and_department(
        db: &DatabaseConnection,
        name: &str,
        department_id: i32,
    ) -> ModelResult<Option<Self>> {
        Ok(teams::Entity::find()
            .filter(teams::Column::DepartmentId.eq(department_id))
            .filter(teams::Column::Name.eq(name))
            .filter(teams::Column::DeletedAt.is_null())
            .one(db)
            .await?)
    }
}

impl ActiveModel {}
impl Entity {}
