use loco_rs::prelude::*;
use sea_orm::{Condition, QueryOrder};
use uuid::Uuid;

pub use super::_entities::asset_inspections::{self, ActiveModel, Entity, Model};
use super::_entities::{assets, departments, teams};

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if insert {
            let mut this = self;
            this.pid = ActiveValue::Set(Uuid::new_v4());
            Ok(this)
        } else {
            let mut this = self;
            if this.updated_at.is_unchanged() {
                this.updated_at = ActiveValue::Set(chrono::Utc::now().into());
            }
            Ok(this)
        }
    }
}

pub struct InspectionWithAsset {
    pub inspection: Model,
    pub asset: Option<assets::Model>,
    pub department_name: Option<String>,
    pub team_name: Option<String>,
}

impl Model {
    pub async fn delete_by_asset(db: &DatabaseConnection, asset_id: i32) -> ModelResult<()> {
        asset_inspections::Entity::delete_many()
            .filter(asset_inspections::Column::AssetId.eq(asset_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn delete_by_pids(db: &DatabaseConnection, pids: &[String]) -> ModelResult<()> {
        if pids.is_empty() {
            return Ok(());
        }
        let uuids: Vec<Uuid> = pids.iter().filter_map(|p| Uuid::parse_str(p).ok()).collect();
        asset_inspections::Entity::delete_many()
            .filter(asset_inspections::Column::Pid.is_in(uuids))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn find_all_by_asset(
        db: &DatabaseConnection,
        asset_id: i32,
    ) -> ModelResult<Vec<Self>> {
        Ok(asset_inspections::Entity::find()
            .filter(
                Condition::all()
                    .add(asset_inspections::Column::AssetId.eq(asset_id))
                    .add(asset_inspections::Column::DeletedAt.is_null()),
            )
            .order_by_desc(asset_inspections::Column::CreatedAt)
            .all(db)
            .await?)
    }

    pub async fn find_by_pid(db: &DatabaseConnection, pid: &str) -> ModelResult<Self> {
        let uuid = Uuid::parse_str(pid).map_err(|e| ModelError::Any(e.into()))?;
        let item = asset_inspections::Entity::find()
            .filter(
                Condition::all()
                    .add(asset_inspections::Column::Pid.eq(uuid))
                    .add(asset_inspections::Column::DeletedAt.is_null()),
            )
            .one(db)
            .await?;
        item.ok_or_else(|| ModelError::EntityNotFound)
    }

    pub async fn find_all_by_company(
        db: &DatabaseConnection,
        company_id: i32,
        asset_name: Option<&str>,
        department_pid: Option<&str>,
        team_pid: Option<&str>,
        inspection_type: Option<&str>,
        inspection_result: Option<&str>,
        date_from: Option<chrono::NaiveDate>,
        date_to: Option<chrono::NaiveDate>,
    ) -> ModelResult<Vec<InspectionWithAsset>> {
        // dept/team PID → ID 변환
        let dept_id_filter: Option<i32> = if let Some(dpid) = department_pid {
            if !dpid.is_empty() {
                if let Ok(uuid) = Uuid::parse_str(dpid) {
                    departments::Entity::find()
                        .filter(departments::Column::Pid.eq(uuid))
                        .one(db)
                        .await?
                        .map(|d| d.id)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let team_id_filter: Option<i32> = if let Some(tpid) = team_pid {
            if !tpid.is_empty() {
                if let Ok(uuid) = Uuid::parse_str(tpid) {
                    teams::Entity::find()
                        .filter(teams::Column::Pid.eq(uuid))
                        .one(db)
                        .await?
                        .map(|t| t.id)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        // 회사 내 자산 ID 목록 먼저 구성
        let mut asset_query = assets::Entity::find().filter(
            Condition::all()
                .add(assets::Column::CompanyId.eq(company_id))
                .add(assets::Column::DeletedAt.is_null()),
        );

        if let Some(name) = asset_name {
            if !name.is_empty() {
                asset_query =
                    asset_query.filter(assets::Column::Name.like(format!("%{}%", name)));
            }
        }
        if let Some(did) = dept_id_filter {
            asset_query = asset_query.filter(assets::Column::DepartmentId.eq(did));
        }
        if let Some(tid) = team_id_filter {
            asset_query = asset_query.filter(assets::Column::TeamId.eq(tid));
        }

        let matching_assets = asset_query.all(db).await?;
        if matching_assets.is_empty() {
            return Ok(vec![]);
        }

        let asset_ids: Vec<i32> = matching_assets.iter().map(|a| a.id).collect();

        // 점검이력 조회
        let mut insp_query = asset_inspections::Entity::find()
            .filter(
                Condition::all()
                    .add(asset_inspections::Column::AssetId.is_in(asset_ids))
                    .add(asset_inspections::Column::DeletedAt.is_null()),
            )
            .order_by_desc(asset_inspections::Column::CreatedAt);

        if let Some(t) = inspection_type {
            if !t.is_empty() {
                insp_query =
                    insp_query.filter(asset_inspections::Column::InspectionType.eq(t));
            }
        }
        if let Some(r) = inspection_result {
            if !r.is_empty() {
                insp_query =
                    insp_query.filter(asset_inspections::Column::InspectionResult.eq(r));
            }
        }
        if let Some(from) = date_from {
            insp_query =
                insp_query.filter(asset_inspections::Column::InspectionDate.gte(from));
        }
        if let Some(to) = date_to {
            insp_query =
                insp_query.filter(asset_inspections::Column::InspectionDate.lte(to));
        }

        let inspections = insp_query.all(db).await?;

        // 부서/팀 이름 batch 조회
        let dept_ids: Vec<i32> =
            matching_assets.iter().filter_map(|a| a.department_id).collect();
        let team_ids: Vec<i32> = matching_assets.iter().filter_map(|a| a.team_id).collect();

        let dept_map: std::collections::HashMap<i32, String> = if dept_ids.is_empty() {
            std::collections::HashMap::new()
        } else {
            departments::Entity::find()
                .filter(departments::Column::Id.is_in(dept_ids))
                .all(db)
                .await?
                .into_iter()
                .map(|d| (d.id, d.name))
                .collect()
        };

        let team_map: std::collections::HashMap<i32, String> = if team_ids.is_empty() {
            std::collections::HashMap::new()
        } else {
            teams::Entity::find()
                .filter(teams::Column::Id.is_in(team_ids))
                .all(db)
                .await?
                .into_iter()
                .map(|t| (t.id, t.name))
                .collect()
        };

        let result = inspections
            .into_iter()
            .map(|ins| {
                let asset = matching_assets.iter().find(|a| a.id == ins.asset_id).cloned();
                let department_name = asset
                    .as_ref()
                    .and_then(|a| a.department_id)
                    .and_then(|id| dept_map.get(&id).cloned());
                let team_name = asset
                    .as_ref()
                    .and_then(|a| a.team_id)
                    .and_then(|id| team_map.get(&id).cloned());
                InspectionWithAsset { inspection: ins, asset, department_name, team_name }
            })
            .collect();

        Ok(result)
    }
}

impl ActiveModel {}
impl Entity {}
