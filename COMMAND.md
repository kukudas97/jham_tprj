# Docker Setup

Generate:
- docker-compose.yml
- .env.example
- nginx.conf

Stack:
- PostgreSQL
- Redis
- Rust Loco Backend
- React Frontend

Requirements:
- Backend: 5150
- Frontend: 5173
- PostgreSQL: 5432
- Redis: 6379
- Use Docker volumes
- Enable hot reload

---

# Scaffold

Generate scaffolds for:
- company
- asset
- asset_inspection
- qr_code

Rules:
- Preserve Loco scaffold structure
- Keep controllers thin
- Put business logic in services
- Use REST APIs
- Use DTO/view separation

---

# QR Feature

Implement QR generation and scanning.

Requirements:
- Use qrcode crate
- Save images in qr/
- QR contains asset UUID

---

# Excel Upload

Implement Excel upload API.

Requirements:
- Parse xlsx
- Validate columns
- Bulk insert assets
- Save upload history

---

# Auth

Implement JWT authentication.

Requirements:
- Login API
- Refresh token
- company_id authorization