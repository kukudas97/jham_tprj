use image::Luma;
use qrcode::QrCode;
use std::path::PathBuf;

const QR_DIR: &str = "qr";

pub fn generate(asset_pid: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    std::fs::create_dir_all(QR_DIR)?;

    let code = QrCode::new(asset_pid.as_bytes())?;
    let image = code.render::<Luma<u8>>().build();

    let filename = format!("{}.png", asset_pid);
    let path = PathBuf::from(QR_DIR).join(&filename);
    image.save(&path)?;

    Ok(format!("{}/{}", QR_DIR, filename))
}
