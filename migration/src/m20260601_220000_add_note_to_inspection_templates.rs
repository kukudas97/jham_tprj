use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InspectionTemplates::Table)
                    .add_column(ColumnDef::new(InspectionTemplates::Note).text().null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InspectionTemplates::Table)
                    .drop_column(InspectionTemplates::Note)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
enum InspectionTemplates {
    Table,
    Note,
}
