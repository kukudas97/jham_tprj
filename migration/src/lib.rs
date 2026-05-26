#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;
mod m20220101_000001_users;

mod m20260526_071529_companies;
mod m20260526_073549_assets;
mod m20260526_073809_asset_inspections;
mod m20260526_073941_qr_codes;
mod m20260526_100000_add_company_id_to_users;
mod m20260526_110000_asset_uploads;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_users::Migration),
            Box::new(m20260526_071529_companies::Migration),
            Box::new(m20260526_073549_assets::Migration),
            Box::new(m20260526_073809_asset_inspections::Migration),
            Box::new(m20260526_073941_qr_codes::Migration),
            Box::new(m20260526_100000_add_company_id_to_users::Migration),
            Box::new(m20260526_110000_asset_uploads::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}