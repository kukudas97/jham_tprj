use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("assets"))
                    .add_column(ColumnDef::new(Alias::new("department_id")).integer().null())
                    .add_column(ColumnDef::new(Alias::new("team_id")).integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_assets_department_id")
                    .from(Alias::new("assets"), Alias::new("department_id"))
                    .to(Alias::new("departments"), Alias::new("id"))
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_assets_team_id")
                    .from(Alias::new("assets"), Alias::new("team_id"))
                    .to(Alias::new("teams"), Alias::new("id"))
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_foreign_key(
                ForeignKey::drop()
                    .name("fk_assets_team_id")
                    .table(Alias::new("assets"))
                    .to_owned(),
            )
            .await?;

        manager
            .drop_foreign_key(
                ForeignKey::drop()
                    .name("fk_assets_department_id")
                    .table(Alias::new("assets"))
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("assets"))
                    .drop_column(Alias::new("department_id"))
                    .drop_column(Alias::new("team_id"))
                    .to_owned(),
            )
            .await
    }
}
