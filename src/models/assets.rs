use loco_rs::prelude::*;
use uuid::Uuid;

pub use super::_entities::assets::{self, ActiveModel, Entity, Model};

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if insert {
            let mut this = self;
            this.pid = ActiveValue::Set(Uuid::new_v4());
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
    pub async fn find_all_by_company(
        db: &DatabaseConnection,
        company_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(assets::Entity::find()
            .filter(
                model::query::condition()
                    .eq(assets::Column::CompanyId, company_id)
                    .is_null(assets::Column::DeletedAt)
                    .build(),
            )
            .all(db)
            .await?)
    }

    pub async fn find_by_pid(db: &DatabaseConnection, pid: &str) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = assets::Entity::find()
            .filter(
                model::query::condition()
                    .eq(assets::Column::Pid, uuid)
                    .is_null(assets::Column::DeletedAt)
                    .build(),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }

    pub async fn find_by_pid_and_company(
        db: &DatabaseConnection,
        pid: &str,
        company_id: i32,
    ) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = assets::Entity::find()
            .filter(
                model::query::condition()
                    .eq(assets::Column::Pid, uuid)
                    .eq(assets::Column::CompanyId, company_id)
                    .is_null(assets::Column::DeletedAt)
                    .build(),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }
}

impl ActiveModel {}
impl Entity {}
