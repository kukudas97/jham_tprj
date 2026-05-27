use loco_rs::prelude::*;
use sea_orm::ColumnTrait;

pub use super::_entities::asset_field_values::{self, ActiveModel, Entity, Model};

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if insert {
            let mut this = self;
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
    pub async fn find_by_asset(
        db: &DatabaseConnection,
        asset_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(Entity::find()
            .filter(asset_field_values::Column::AssetId.eq(asset_id))
            .all(db)
            .await?)
    }

    pub async fn find_by_assets(
        db: &DatabaseConnection,
        asset_ids: Vec<i32>,
    ) -> ModelResult<Vec<Self>> {
        Ok(Entity::find()
            .filter(asset_field_values::Column::AssetId.is_in(asset_ids))
            .all(db)
            .await?)
    }

    pub async fn delete_by_asset(db: &DatabaseConnection, asset_id: i32) -> ModelResult<()> {
        Entity::delete_many()
            .filter(asset_field_values::Column::AssetId.eq(asset_id))
            .exec(db)
            .await?;
        Ok(())
    }
}

impl ActiveModel {}
impl Entity {}
