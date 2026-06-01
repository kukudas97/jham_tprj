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
mod m20260527_000001_asset_categories;
mod m20260527_000002_add_category_to_assets;
mod m20260527_000003_add_required_fields_to_categories;
mod m20260527_000004_category_field_defs;
mod m20260527_000005_asset_field_values;
mod m20260527_000006_add_photo_to_assets;
mod m20260601_000001_departments;
mod m20260601_000002_teams;
mod m20260601_000003_add_dept_team_to_assets;
mod m20260601_100000_make_serial_number_required_unique;
mod m20260601_140000_add_manager_to_assets;
mod m20260601_200000_extend_asset_inspections;
mod m20260601_210000_inspection_templates;
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
            Box::new(m20260527_000001_asset_categories::Migration),
            Box::new(m20260527_000002_add_category_to_assets::Migration),
            Box::new(m20260527_000003_add_required_fields_to_categories::Migration),
            Box::new(m20260527_000004_category_field_defs::Migration),
            Box::new(m20260527_000005_asset_field_values::Migration),
            Box::new(m20260527_000006_add_photo_to_assets::Migration),
            Box::new(m20260601_000001_departments::Migration),
            Box::new(m20260601_000002_teams::Migration),
            Box::new(m20260601_000003_add_dept_team_to_assets::Migration),
            Box::new(m20260601_100000_make_serial_number_required_unique::Migration),
            Box::new(m20260601_140000_add_manager_to_assets::Migration),
            Box::new(m20260601_200000_extend_asset_inspections::Migration),
            Box::new(m20260601_210000_inspection_templates::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}