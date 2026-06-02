use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        let db = m.get_connection();

        // 기존 전체 인덱스 삭제
        db.execute_unprepared(
            "DROP INDEX IF EXISTS assets_company_serial_unique",
        )
        .await?;

        // 소프트 삭제된 자산(deleted_at IS NOT NULL)을 제외한 부분 인덱스로 재생성
        // → 삭제된 자산과 같은 식별번호를 가진 신규 자산 등록 허용
        db.execute_unprepared(
            "CREATE UNIQUE INDEX IF NOT EXISTS assets_company_serial_unique \
             ON assets (company_id, serial_number) \
             WHERE deleted_at IS NULL",
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
            "CREATE UNIQUE INDEX assets_company_serial_unique \
             ON assets (company_id, serial_number)",
        )
        .await?;

        Ok(())
    }
}
