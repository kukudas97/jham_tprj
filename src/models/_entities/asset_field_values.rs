//! `SeaORM` Entity for asset_field_values

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "asset_field_values")]
pub struct Model {
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    #[sea_orm(primary_key)]
    pub id: i32,
    pub asset_id: i32,
    pub field_def_id: i32,
    pub value: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::assets::Entity",
        from = "Column::AssetId",
        to = "super::assets::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Assets,
    #[sea_orm(
        belongs_to = "super::category_field_defs::Entity",
        from = "Column::FieldDefId",
        to = "super::category_field_defs::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    CategoryFieldDefs,
}

impl Related<super::assets::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Assets.def()
    }
}

impl Related<super::category_field_defs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CategoryFieldDefs.def()
    }
}
