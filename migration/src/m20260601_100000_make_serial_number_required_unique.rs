use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        let db = m.get_connection();

        // NULL 식별번호를 임시 고유값으로 채운 뒤 NOT NULL로 변경
        db.execute_unprepared(
            "UPDATE assets SET serial_number = 'TEMP-' || id::text WHERE serial_number IS NULL",
        )
        .await?;

        // 같은 회사 내 중복 식별번호를 고유값으로 변경
        db.execute_unprepared(
            "UPDATE assets a SET serial_number = serial_number || '-' || id::text \
             WHERE EXISTS ( \
               SELECT 1 FROM assets b \
               WHERE b.company_id = a.company_id AND b.serial_number = a.serial_number AND b.id <> a.id \
             )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE assets ALTER COLUMN serial_number SET NOT NULL",
        )
        .await?;

        // 같은 회사 내 식별번호 중복 불가
        db.execute_unprepared(
            "CREATE UNIQUE INDEX assets_company_serial_unique ON assets (company_id, serial_number)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        let db = m.get_connection();
        db.execute_unprepared(
            "DROP INDEX IF EXISTS assets_company_serial_unique",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE assets ALTER COLUMN serial_number DROP NOT NULL",
        )
        .await?;
        Ok(())
    }
}
