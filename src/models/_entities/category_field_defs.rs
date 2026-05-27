//! `SeaORM` Entity for category_field_defs

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "category_field_defs")]
pub struct Model {
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    #[sea_orm(primary_key)]
    pub id: i32,
    pub pid: Uuid,
    pub category_id: i32,
    pub company_id: i32,
    pub field_name: String,
    pub field_label: String,
    pub is_required: bool,
    pub sort_order: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::asset_categories::Entity",
        from = "Column::CategoryId",
        to = "super::asset_categories::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    AssetCategories,
    #[sea_orm(
        belongs_to = "super::companies::Entity",
        from = "Column::CompanyId",
        to = "super::companies::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Companies,
    #[sea_orm(has_many = "super::asset_field_values::Entity")]
    AssetFieldValues,
}

impl Related<super::asset_categories::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::AssetCategories.def()
    }
}

impl Related<super::companies::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Companies.def()
    }
}

impl Related<super::asset_field_values::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::AssetFieldValues.def()
    }
}
