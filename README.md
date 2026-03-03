# Gamma Oracle — Hari 3 Training Project

FastAPI + Oracle Database + Next.js 15 full-stack CRUD application built during **Hari 3 Pelatihan API & Git Engineering**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.115, python-oracledb 2.5 |
| Database | Oracle Database (XE / XEPDB1) |
| Frontend | Next.js 15 (App Router, JavaScript) |

## Project Structure

```
gamma-oracle/
├── backend/
│   ├── app/
│   │   ├── database.py        # Connection pool (python-oracledb)
│   │   ├── responses.py       # Standardized JSON envelopes
│   │   ├── main.py            # FastAPI app + lifespan + CORS
│   │   └── routers/
│   │       └── documents.py   # 5 CRUD endpoints
│   ├── docs/
│   │   ├── DOCUMENTS.sql      # Oracle DDL (table + sequence + trigger)
│   │   └── postman_collection.json
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    │   ├── layout.js          # Root layout + navbar
    │   ├── page.js            # Landing / hero page
    │   └── documents/
    │       ├── page.js        # List (pagination + filter)
    │       ├── new/page.js    # Create form
    │       └── [id]/page.js   # Edit + delete
    ├── lib/
    │   └── api.js             # Centralized API client
    └── .env.local
```

## Prerequisites

- **Oracle Database** (XE or enterprise) accessible at `localhost:1521/XEPDB1`
- Python **3.10+**
- Node.js **18+**

## Setup

### 1 — Oracle Database

Connect as DBA and run the DDL script:

```sql
-- As sysdba or table owner:
@backend/docs/DOCUMENTS.sql
```

Buat user jika belum ada:

```sql
CREATE USER training_user IDENTIFIED BY SecurePass123;
GRANT CONNECT, RESOURCE TO training_user;
GRANT UNLIMITED TABLESPACE TO training_user;
```

### 2 — Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure connection (edit .env)
cp .env.example .env
# → set ORACLE_USER, ORACLE_PASSWORD, ORACLE_DSN

# Run development server
uvicorn app.main:app --reload --port 8000
```

API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
Health check: [http://localhost:8000/health/db](http://localhost:8000/health/db)

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | App health |
| GET | `/health/db` | DB connection + pool stats |
| GET | `/v1/documents` | List (pagination + category filter) |
| GET | `/v1/documents/{id}` | Single document |
| POST | `/v1/documents` | Create |
| PUT | `/v1/documents/{id}` | Update |
| DELETE | `/v1/documents/{id}` | Soft-delete (status=DELETED) |

## Konsep yang Diimplementasikan (Hari 3)

- **Connection Pooling** — `oracledb.create_pool()` min=2 max=10, reuse per request
- **Dependency Injection** — `get_db()` generator sebagai FastAPI `Depends`
- **Transaction Management** — `conn.commit()` / `conn.rollback()` eksplisit
- **Parameter Binding** — Named parameters (`:name`) mencegah SQL injection
- **Lifespan Manager** — Pool dibuat saat startup, ditutup saat shutdown
- **CORS** — `CORSMiddleware` untuk Next.js di `localhost:3000`
- **Loading States** — `fetchLoading` (initial) dan `loading` (submit)
- **Error Handling** — Alert banners + retry button di setiap page

## Trainer

**Sulaiman** — Target: Pegawai Dinas SITP
