use loco_rs::prelude::*;
use uuid::Uuid;

pub use super::_entities::asset_categories::{self, ActiveModel, Entity, Model};

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
    pub async fn find_all_by_company(
        db: &DatabaseConnection,
        company_id: i32,
    ) -> ModelResult<Vec<Self>> {
        use sea_orm::QueryOrder;
        Ok(asset_categories::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_categories::Column::CompanyId, company_id)
                    .build(),
            )
            .order_by_asc(asset_categories::Column::SortOrder)
            .all(db)
            .await?)
    }

    pub async fn find_by_pid_and_company(
        db: &DatabaseConnection,
        pid: &str,
        company_id: i32,
    ) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = asset_categories::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_categories::Column::Pid, uuid)
                    .eq(asset_categories::Column::CompanyId, company_id)
                    .build(),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }

    pub async fn find_by_ids(
        db: &DatabaseConnection,
        ids: Vec<i32>,
    ) -> ModelResult<Vec<Self>> {
        use sea_orm::ColumnTrait;
        Ok(asset_categories::Entity::find()
            .filter(asset_categories::Column::Id.is_in(ids))
            .all(db)
            .await?)
    }

    pub async fn find_by_name_and_company(
        db: &DatabaseConnection,
        name: &str,
        company_id: i32,
    ) -> ModelResult<Option<Self>> {
        Ok(asset_categories::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_categories::Column::Name, name)
                    .eq(asset_categories::Column::CompanyId, company_id)
                    .build(),
            )
            .one(db)
            .await?)
    }

    pub async fn find_children(
        db: &DatabaseConnection,
        parent_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(asset_categories::Entity::find()
            .filter(
                model::query::condition()
                    .eq(asset_categories::Column::ParentId, parent_id)
                    .build(),
            )
            .all(db)
            .await?)
    }
}

impl ActiveModel {}
impl Entity {}
