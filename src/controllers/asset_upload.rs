#![allow(clippy::missing_errors_doc)]
#![allow(clippy::unused_async)]
use axum::extract::Multipart;
use calamine::{open_workbook_from_rs, Data, DataType, Reader, Xlsx};
use loco_rs::prelude::*;
use std::io::Cursor;

use crate::models::asset_uploads::{self, STATUS_FAILED, STATUS_SUCCESS};
use crate::models::assets;
use crate::models::users;
use crate::views::asset_upload::AssetUploadResponse;

#[debug_handler]
pub async fn upload(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    mut multipart: Multipart,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let company_id = user
        .company_id
        .ok_or_else(|| Error::Unauthorized("사용자에게 회사가 할당되지 않았습니다.".to_string()))?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?
        .ok_or_else(|| Error::BadRequest("파일이 없습니다.".to_string()))?;

    let filename = field
        .file_name()
        .unwrap_or("upload.xlsx")
        .to_string();
    let bytes = field
        .bytes()
        .await
        .map_err(|e| Error::BadRequest(e.to_string()))?;

    let (status, error_message, inserted) = parse_and_insert(&ctx.db, &bytes, company_id).await;

    let upload_record = asset_uploads::ActiveModel {
        company_id: Set(company_id),
        filename: Set(filename.clone()),
        status: Set(status.to_string()),
        error_message: Set(error_message.clone()),
        ..Default::default()
    }
    .insert(&ctx.db)
    .await?;

    let mut response = AssetUploadResponse::from(upload_record);
    response.filename = filename;

    if error_message.is_some() {
        return format::json(response);
    }

    tracing::info!(inserted, "asset upload completed");
    format::json(response)
}

async fn parse_and_insert(
    db: &sea_orm::DatabaseConnection,
    bytes: &[u8],
    company_id: i32,
) -> (&'static str, Option<String>, usize) {
    match do_parse_and_insert(db, bytes, company_id).await {
        Ok(n) => (STATUS_SUCCESS, None, n),
        Err(e) => (STATUS_FAILED, Some(e), 0),
    }
}

async fn do_parse_and_insert(
    db: &sea_orm::DatabaseConnection,
    bytes: &[u8],
    company_id: i32,
) -> Result<usize, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook: Xlsx<_> =
        open_workbook_from_rs(cursor).map_err(|e| format!("xlsx 파싱 실패: {}", e))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "시트가 없습니다.".to_string())?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("시트 읽기 실패: {}", e))?;

    let mut rows = range.rows();

    let header = rows
        .next()
        .ok_or_else(|| "헤더 행이 없습니다.".to_string())?;

    let col_index = |name: &str| -> Option<usize> {
        header.iter().position(|c| {
            DataType::get_string(c)
                .map(|s| s.eq_ignore_ascii_case(name))
                .unwrap_or(false)
        })
    };

    let name_col = col_index("name").ok_or_else(|| "name 컬럼이 없습니다.".to_string())?;
    let serial_col = col_index("serial_number");
    let location_col = col_index("location");
    let note_col = col_index("note");

    let get_str = |row: &[Data], idx: Option<usize>| -> Option<String> {
        idx.and_then(|i| row.get(i)).and_then(|v| {
            let s = DataType::get_string(v).unwrap_or("").trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
    };

    let mut count = 0usize;
    for row in rows {
        let name = match row.get(name_col).and_then(|v| DataType::get_string(v)) {
            Some(s) if !s.trim().is_empty() => s.trim().to_string(),
            _ => continue,
        };

        assets::ActiveModel {
            name: Set(name),
            company_id: Set(company_id),
            serial_number: Set(get_str(row, serial_col)),
            location: Set(get_str(row, location_col)),
            note: Set(get_str(row, note_col)),
            ..Default::default()
        }
        .insert(db)
        .await
        .map_err(|e| format!("DB 인서트 실패: {}", e))?;

        count += 1;
    }

    Ok(count)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/assets/")
        .add("upload", post(upload))
}
