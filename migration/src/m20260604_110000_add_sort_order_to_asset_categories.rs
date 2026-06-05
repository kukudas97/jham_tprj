use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260604_110000_add_sort_order_to_asset_categories"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("asset_categories"))
                    .add_column(
                        ColumnDef::new(Alias::new("sort_order"))
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .to_owned(),
            )
            .await?;

        // Initialize sort_order based on existing id order within each company+parent group
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                UPDATE asset_categories ac
                SET sort_order = sub.row_num - 1
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY company_id, COALESCE(parent_id, -1)
                               ORDER BY id
                           ) AS row_num
                    FROM asset_categories
                ) sub
                WHERE ac.id = sub.id
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("asset_categories"))
                    .drop_column(Alias::new("sort_order"))
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}
