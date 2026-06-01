use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

use crate::models::departments;
use crate::models::teams;

/// 부서를 이름으로 조회하거나 없으면 신규 생성.
/// cache에 이미 있으면 DB 조회 없이 반환.
pub async fn find_or_create_department(
    db: &DatabaseConnection,
    cache: &mut Vec<departments::Model>,
    name: &str,
    company_id: i32,
) -> Result<departments::Model, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("부서명이 비어 있습니다.".to_string());
    }

    if let Some(existing) = cache.iter().find(|d| d.name == trimmed) {
        return Ok(existing.clone());
    }

    let new_dept = departments::ActiveModel {
        company_id: Set(company_id),
        name: Set(trimmed.to_string()),
        deleted_at: Set(None),
        ..Default::default()
    }
    .insert(db)
    .await
    .map_err(|e| format!("부서 '{}' 생성 실패: {}", trimmed, e))?;

    tracing::info!(name = trimmed, "부서 자동 생성");
    cache.push(new_dept.clone());
    Ok(new_dept)
}

/// 팀을 이름/부서로 조회하거나 없으면 신규 생성.
/// cache에 이미 있으면 DB 조회 없이 반환.
pub async fn find_or_create_team(
    db: &DatabaseConnection,
    cache: &mut Vec<teams::Model>,
    name: &str,
    department_id: i32,
    company_id: i32,
) -> Result<teams::Model, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("팀명이 비어 있습니다.".to_string());
    }

    if let Some(existing) =
        cache.iter().find(|t| t.department_id == department_id && t.name == trimmed)
    {
        return Ok(existing.clone());
    }

    let new_team = teams::ActiveModel {
        company_id: Set(company_id),
        department_id: Set(department_id),
        name: Set(trimmed.to_string()),
        deleted_at: Set(None),
        ..Default::default()
    }
    .insert(db)
    .await
    .map_err(|e| format!("팀 '{}' 생성 실패: {}", trimmed, e))?;

    tracing::info!(name = trimmed, "팀 자동 생성");
    cache.push(new_team.clone());
    Ok(new_team)
}

/// 기존 자산의 location(부서명) / 팀명 커스텀 필드를 읽어
/// departments / teams 테이블을 채우고 assets.department_id / team_id를 매핑.
pub async fn sync_assets_to_departments(
    db: &DatabaseConnection,
    company_id: i32,
) -> Result<usize, String> {
    use crate::models::_entities::asset_field_values::Column as FvCol;
    use crate::models::_entities::assets::Column as AssetCol;
    use crate::models::asset_field_values;
    use crate::models::assets;
    use crate::models::category_field_defs;

    // 아직 department_id가 없는 자산만 대상
    let target_assets = assets::Entity::find()
        .filter(AssetCol::CompanyId.eq(company_id))
        .filter(AssetCol::DeletedAt.is_null())
        .filter(AssetCol::DepartmentId.is_null())
        .all(db)
        .await
        .map_err(|e| format!("자산 조회 실패: {}", e))?;

    if target_assets.is_empty() {
        return Ok(0);
    }

    // 팀명 field_def 조회 (있을 수도 없을 수도)
    let all_defs = category_field_defs::Model::find_by_company(db, company_id)
        .await
        .map_err(|e| format!("필드 정의 조회 실패: {}", e))?;

    let team_def_ids: Vec<i32> = all_defs
        .iter()
        .filter(|d| d.field_label == "팀명" || d.field_name == "팀명")
        .map(|d| d.id)
        .collect();

    // 자산 ID로 팀명 커스텀 필드 값 일괄 조회
    let asset_ids: Vec<i32> = target_assets.iter().map(|a| a.id).collect();
    let team_fvs = if !team_def_ids.is_empty() {
        asset_field_values::Entity::find()
            .filter(FvCol::AssetId.is_in(asset_ids.clone()))
            .filter(FvCol::FieldDefId.is_in(team_def_ids))
            .all(db)
            .await
            .map_err(|e| format!("팀명 필드값 조회 실패: {}", e))?
    } else {
        vec![]
    };

    // asset_id → team_name 맵
    let mut team_name_map: std::collections::HashMap<i32, String> =
        std::collections::HashMap::new();
    for fv in team_fvs {
        if let Some(v) = fv.value {
            let v = v.trim().to_string();
            if !v.is_empty() {
                team_name_map.insert(fv.asset_id, v);
            }
        }
    }

    let mut dept_cache: Vec<departments::Model> =
        departments::Model::find_all_active_by_company(db, company_id)
            .await
            .map_err(|e| format!("부서 조회 실패: {}", e))?;

    let mut team_cache: Vec<teams::Model> =
        teams::Model::find_all_active_by_company(db, company_id)
            .await
            .map_err(|e| format!("팀 조회 실패: {}", e))?;

    let mut updated = 0usize;

    for asset in target_assets {
        let dept_name = match asset.location.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let dept =
            find_or_create_department(db, &mut dept_cache, &dept_name, company_id).await?;

        let team_id = if let Some(team_name) = team_name_map.get(&asset.id) {
            let team =
                find_or_create_team(db, &mut team_cache, team_name, dept.id, company_id).await?;
            Some(team.id)
        } else {
            None
        };

        let mut active: assets::ActiveModel = asset.into();
        active.department_id = Set(Some(dept.id));
        active.team_id = Set(team_id);
        active
            .update(db)
            .await
            .map_err(|e| format!("자산 업데이트 실패: {}", e))?;

        updated += 1;
    }

    Ok(updated)
}
