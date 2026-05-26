use loco_rs::prelude::*;
use uuid::Uuid;

pub use super::_entities::asset_uploads::{self, ActiveModel, Entity, Model};

pub const STATUS_SUCCESS: &str = "success";
pub const STATUS_FAILED: &str = "failed";

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
        Ok(asset_uploads::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_uploads::Column::CompanyId, company_id)
                    .build(),
            )
            .all(db)
            .await?)
    }
}

impl ActiveModel {}
impl Entity {}
