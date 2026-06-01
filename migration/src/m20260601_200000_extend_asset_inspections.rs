use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.alter_table(
            Table::alter()
                .table(AssetInspections::Table)
                .add_column(
                    ColumnDef::new(AssetInspections::InspectionType)
                        .string()
                        .not_null()
                        .default("일반점검"),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::InspectionResult)
                        .string()
                        .null(),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::InspectionDate)
                        .date()
                        .null(),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::PeriodStart)
                        .date()
                        .null(),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::PeriodEnd)
                        .date()
                        .null(),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::Remarks)
                        .string()
                        .null(),
                )
                .add_column(
                    ColumnDef::new(AssetInspections::DeletedAt)
                        .timestamp_with_time_zone()
                        .null(),
                )
                .to_owned(),
        )
        .await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.alter_table(
            Table::alter()
                .table(AssetInspections::Table)
                .drop_column(AssetInspections::InspectionType)
                .drop_column(AssetInspections::InspectionResult)
                .drop_column(AssetInspections::InspectionDate)
                .drop_column(AssetInspections::PeriodStart)
                .drop_column(AssetInspections::PeriodEnd)
                .drop_column(AssetInspections::Remarks)
                .drop_column(AssetInspections::DeletedAt)
                .to_owned(),
        )
        .await
    }
}

#[derive(Iden)]
enum AssetInspections {
    Table,
    InspectionType,
    InspectionResult,
    InspectionDate,
    PeriodStart,
    PeriodEnd,
    Remarks,
    DeletedAt,
}
