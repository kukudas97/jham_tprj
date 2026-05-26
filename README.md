# JHAM Asset Management System

QR 기반 웹 자산관리 시스템입니다.

기존 엑셀 기반 자산관리 환경을 웹 기반으로 전환하고,
QR 코드를 활용하여 모바일에서 자산 조회 및 점검을 수행할 수 있습니다.

---

# Features

- Asset CRUD
- Company-based Asset Isolation
- Excel Upload
- QR Code Generation
- Mobile QR Scan
- Asset Inspection History
- JWT Authentication
- REST API

---

# Tech Stack

## Frontend

- React
- TypeScript
- Vite
- Axios
- html5-qrcode

## Backend

- Rust
- Loco
- Tokio Async Runtime
- SeaORM
- JWT Authentication

## Database

- PostgreSQL

## Cache/Auth

- Redis

## Infra

- Docker
- Docker Compose
- Nginx
- Oracle Cloud Infrastructure

---

# Architecture

- Frontend and backend are separated
- Backend provides REST APIs
- Follow Loco scaffold conventions
- Preserve scaffold-generated CRUD structure
- Keep controllers thin
- Use service layer for complex business logic

---

# Folder Structure

```text
project-root/
├── frontend/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── views/
│   ├── services/
│   ├── workers/
│   └── app.rs
├── migration/
├── config/
├── uploads/
├── qr/
├── docs/
├── docker/
├── README.md
├── COMMAND.md
├── CLAUDE.md
└── docker-compose.yml