use loco_rs::prelude::*;
use uuid::Uuid;

pub use super::_entities::asset_inspections::{self, ActiveModel, Entity, Model};

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
    pub async fn find_all_by_asset(
        db: &DatabaseConnection,
        asset_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(asset_inspections::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_inspections::Column::AssetId, asset_id)
                    .build(),
            )
            .all(db)
            .await?)
    }

    pub async fn find_by_pid(db: &DatabaseConnection, pid: &str) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = asset_inspections::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_inspections::Column::Pid, uuid)
                    .build(),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }
}

impl ActiveModel {}
impl Entity {}
