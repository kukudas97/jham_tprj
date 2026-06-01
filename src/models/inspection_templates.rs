use loco_rs::prelude::*;
use sea_orm::{Condition, QueryOrder};
use uuid::Uuid;

pub use super::_entities::inspection_templates::{self, ActiveModel, Entity, Model};

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if insert {
            let mut this = self;
            this.pid = ActiveValue::Set(Uuid::new_v4());
            let now: chrono::DateTime<chrono::FixedOffset> = chrono::Utc::now().into();
            this.created_at = ActiveValue::Set(now);
            this.updated_at = ActiveValue::Set(now);
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
    pub async fn find_all_by_user(
        db: &DatabaseConnection,
        company_id: i32,
        user_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(inspection_templates::Entity::find()
            .filter(
                Condition::all()
                    .add(inspection_templates::Column::CompanyId.eq(company_id))
                    .add(inspection_templates::Column::UserId.eq(user_id))
                    .add(inspection_templates::Column::DeletedAt.is_null()),
            )
            .order_by_asc(inspection_templates::Column::SortOrder)
            .order_by_asc(inspection_templates::Column::CreatedAt)
            .all(db)
            .await?)
    }

    pub async fn find_by_pid(db: &DatabaseConnection, pid: &str) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = inspection_templates::Entity::find()
            .filter(
                Condition::all()
                    .add(inspection_templates::Column::Pid.eq(uuid))
                    .add(inspection_templates::Column::DeletedAt.is_null()),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }
}

impl ActiveModel {}
impl Entity {}
