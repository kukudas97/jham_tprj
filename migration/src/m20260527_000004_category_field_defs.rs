use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("category_field_defs"))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Alias::new("pid")).uuid().not_null().unique_key())
                    .col(ColumnDef::new(Alias::new("category_id")).integer().not_null())
                    .col(ColumnDef::new(Alias::new("company_id")).integer().not_null())
                    .col(ColumnDef::new(Alias::new("field_name")).string().not_null())
                    .col(ColumnDef::new(Alias::new("field_label")).string().not_null())
                    .col(
                        ColumnDef::new(Alias::new("is_required"))
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(Alias::new("sort_order"))
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Alias::new("created_at"))
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("updated_at"))
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_field_defs_category")
                            .from(Alias::new("category_field_defs"), Alias::new("category_id"))
                            .to(Alias::new("asset_categories"), Alias::new("id"))
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_field_defs_company")
                            .from(Alias::new("category_field_defs"), Alias::new("company_id"))
                            .to(Alias::new("companies"), Alias::new("id"))
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Alias::new("category_field_defs")).to_owned())
            .await
    }
}
