use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "asset_uploads",
            &[
                ("id", ColType::PkAuto),
                ("pid", ColType::Uuid),
                ("filename", ColType::String),
                ("status", ColType::String),
                ("error_message", ColType::StringNull),
            ],
            &[("company", "")],
        )
        .await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "asset_uploads").await
    }
}
