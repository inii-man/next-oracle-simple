# 📚 Dokumentasi Kode — Gamma Oracle

Penjelasan lengkap setiap file di repo ini, baris per baris.

---

## Struktur Repo

```
gamma-oracle/
├── backend/
│   ├── .env                      ← variabel environment (kredensial DB)
│   ├── .env.example              ← template .env untuk onboarding
│   ├── requirements.txt          ← daftar library Python
│   ├── setup_db.py               ← skrip setup tabel Oracle
│   └── app/
│       ├── __init__.py           ← penanda package Python
│       ├── main.py               ← entry point FastAPI
│       ├── database.py           ← connection pooling Oracle
│       ├── responses.py          ← helper format respons standar
│       └── routers/
│           ├── __init__.py       ← penanda package
│           └── documents.py      ← semua endpoint CRUD documents
└── frontend/
    ├── .env.local                ← URL backend untuk Next.js
    ├── next.config.mjs           ← konfigurasi Next.js
    ├── package.json              ← daftar dependensi npm
    ├── lib/
    │   └── api.js                ← API client (semua fetch ke backend)
    └── app/
        ├── layout.js             ← layout global + navbar
        ├── page.js               ← halaman beranda (/)
        ├── globals.css           ← CSS global
        └── documents/
            ├── page.js           ← halaman list dokumen (/documents)
            ├── new/page.js       ← halaman buat dokumen baru
            └── [id]/page.js      ← halaman edit dokumen
```

---

## 🐍 BACKEND

---

### `backend/requirements.txt`

Daftar library Python yang dibutuhkan. Install dengan `pip install -r requirements.txt`.

```
fastapi>=0.115.0       ← framework web utama untuk membuat REST API
uvicorn[standard]>=0.30.0  ← ASGI server untuk menjalankan FastAPI
python-oracledb>=2.0.0     ← driver resmi Oracle Database dari Oracle Corp
python-dotenv>=1.0.0       ← membaca file .env ke os.environ
pydantic>=2.0.0            ← validasi data request/response (dipakai FastAPI)
```

---

### `backend/setup_db.py`

Skrip sekali jalan untuk membuat tabel `documents` di Oracle dari nol, beserta seed data.

```python
"""
Quick setup script — creates the DOCUMENTS table in Oracle.   ← docstring penjelasan
Run from the backend directory with the venv active:
  python setup_db.py
"""
import oracledb          # driver Oracle
from dotenv import load_dotenv  # baca file .env
import os                # akses environment variable

load_dotenv()            # muat .env ke os.environ

# Buka koneksi langsung (bukan pool — ini skrip satu kali)
conn = oracledb.connect(
    user=os.getenv("ORACLE_USER", "system"),          # ambil dari .env, fallback "system"
    password=os.getenv("ORACLE_PASSWORD", "password"),
    dsn=os.getenv("ORACLE_DSN", "localhost:1521/freepdb1"),
)
cursor = conn.cursor()   # buat cursor untuk menjalankan SQL

# List SQL yang dieksekusi berurutan
statements = [
    # DROP sequence dulu jika ada — pakai EXCEPTION agar tidak error kalau tidak ada
    """BEGIN
         EXECUTE IMMEDIATE 'DROP SEQUENCE documents_seq';
       EXCEPTION WHEN OTHERS THEN NULL;
       END;""",

    # DROP tabel jika sudah ada (CASCADE CONSTRAINTS: hapus foreign key dulu)
    """BEGIN
         EXECUTE IMMEDIATE 'DROP TABLE documents CASCADE CONSTRAINTS';
       EXCEPTION WHEN OTHERS THEN NULL;
       END;""",

    # Buat sequence untuk auto-increment ID (START WITH 1, naik 1)
    """CREATE SEQUENCE documents_seq
         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE""",

    # Buat tabel utama dengan semua kolom dan constraint
    """CREATE TABLE documents (
         id            NUMBER          NOT NULL,      ← PK, diisi dari sequence
         document_code VARCHAR2(50)    NOT NULL,      ← kode unik dokumen
         title         VARCHAR2(200)   NOT NULL,      ← judul wajib diisi
         content       CLOB,                          ← isi teks panjang (boleh null)
         category      VARCHAR2(20),                  ← POLICY/REPORT/MEMO
         status        VARCHAR2(20)    DEFAULT 'ACTIVE' NOT NULL, ← default ACTIVE
         created_at    TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL, ← waktu buat
         CONSTRAINT pk_documents       PRIMARY KEY (id),
         CONSTRAINT uq_document_code   UNIQUE (document_code), ← kode harus unik
         CONSTRAINT chk_category       CHECK (category IN ('POLICY','REPORT','MEMO')),
         CONSTRAINT chk_status         CHECK (status   IN ('ACTIVE','DRAFT','DELETED'))
       )""",

    # Trigger: sebelum INSERT, isi id dari sequence secara otomatis
    """CREATE OR REPLACE TRIGGER trg_documents_pk
         BEFORE INSERT ON documents
         FOR EACH ROW
       BEGIN
         IF :NEW.id IS NULL THEN          ← hanya isi kalau belum diset manual
           SELECT documents_seq.NEXTVAL INTO :NEW.id FROM DUAL;
         END IF;
       END;""",

    # Seed data — 3 dokumen contoh
    """INSERT INTO documents (document_code, title, content, category, status)
       VALUES ('DOC-001', 'Kebijakan Anggaran 2026', '...', 'POLICY', 'ACTIVE')""",
    """INSERT INTO documents (...) VALUES ('DOC-002', ...)""",
    """INSERT INTO documents (...) VALUES ('DOC-003', ...)""",
]

# Jalankan semua SQL berurutan
for sql in statements:
    cursor.execute(sql)
    print(f"✅ OK: {sql.strip()[:60]}...")  # cetak 60 karakter pertama sebagai preview

conn.commit()    # simpan semua perubahan ke DB
cursor.close()   # tutup cursor
conn.close()     # tutup koneksi
print("\n🎉 Database setup complete!")
```

---

### `backend/app/database.py`

Modul yang mengelola **connection pool** Oracle. Semua koneksi dikontrol di sini, bukan dibuka baru tiap request.

```python
import oracledb           # driver Oracle
from typing import Generator  # type hint untuk generator function
import os
from dotenv import load_dotenv

load_dotenv()  # baca .env

# Ambil kredensial dari environment variable
DB_USER     = os.getenv("ORACLE_USER", "training_user")   # fallback jika .env kosong
DB_PASSWORD = os.getenv("ORACLE_PASSWORD", "SecurePass123")
DB_DSN      = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")

# Konfigurasi ukuran pool
POOL_MIN       = 2   # koneksi minimal yang selalu dibuka (warm connections)
POOL_MAX       = 10  # koneksi maksimal yang boleh dibuka sekaligus
POOL_INCREMENT = 1   # jumlah koneksi baru yang dibuat ketika pool perlu berkembang

_pool = None  # variabel global; None = pool belum dibuat


def create_pool():
    """Buat dan inisialisasi Oracle connection pool."""
    global _pool          # ubah variabel global
    try:
        _pool = oracledb.create_pool(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            min=POOL_MIN,
            max=POOL_MAX,
            increment=POOL_INCREMENT,
            getmode=oracledb.POOL_GETMODE_WAIT,  # tunggu kalau pool penuh (tidak error)
        )
        print(f"✅ Connection pool created: {POOL_MIN}–{POOL_MAX} connections | DSN: {DB_DSN}")
        return _pool
    except oracledb.Error as e:
        (error,) = e.args   # unpack error object Oracle
        print(f"❌ Failed to create pool: {error.message}")
        raise               # lempar ulang agar app tidak jalan tanpa DB


def get_pool():
    """Kembalikan pool yang sudah ada; buat baru kalau belum ada."""
    global _pool
    if _pool is None:
        _pool = create_pool()  # lazy init (jarang dipakai karena lifespan di main.py)
    return _pool


def get_db() -> Generator:
    """
    FastAPI dependency: ambil koneksi dari pool,
    yield ke route handler, lalu kembalikan ke pool.
    """
    pool = get_pool()
    connection = pool.acquire()   # ambil koneksi dari pool
    try:
        yield connection          # berikan ke route handler (pakai Depends(get_db))
    finally:
        connection.close()        # SELALU kembalikan ke pool, bahkan jika error


def close_pool():
    """Tutup pool saat app shutdown."""
    global _pool
    if _pool is not None:
        _pool.close()             # drain semua koneksi
        print("🔒 Connection pool closed")
        _pool = None              # reset ke None


def get_pool_stats() -> dict:
    """Snapshot statistik penggunaan pool (untuk endpoint health check)."""
    pool = get_pool()
    return {
        "opened":    pool.opened,              # total koneksi yang terbuka
        "busy":      pool.busy,                # koneksi yang sedang dipakai
        "available": pool.opened - pool.busy,  # koneksi siap pakai
        "max":       pool.max,
        "min":       pool.min,
    }
```

---

### `backend/app/responses.py`

Helper untuk memastikan **semua** respons API punya format yang sama.

```python
from typing import Any, Optional
from fastapi.responses import JSONResponse  # respons JSON dari FastAPI


def success_response(
    data: Any,                     # data utama yang dikembalikan
    message: Optional[str] = None, # pesan opsional (misal "Created successfully")
    meta: Optional[dict] = None,   # metadata opsional (misal pagination info)
    status_code: int = 200,        # HTTP status code, default 200
) -> JSONResponse:
    """Kembalikan envelope sukses yang terstandarisasi."""
    body: dict = {"success": True, "data": data}  # skeleton respons
    if message:                    # tambahkan message hanya kalau ada isinya
        body["message"] = message
    if meta:                       # tambahkan meta hanya kalau ada isinya
        body["meta"] = meta
    return JSONResponse(content=body, status_code=status_code)
    # Contoh output: {"success": true, "data": {...}, "meta": {...}}


def error_response(
    message: str,                  # pesan error yang human-readable
    status_code: int = 400,        # default 400 Bad Request
    detail: Optional[Any] = None,  # detail teknis opsional (stack trace, dll)
) -> JSONResponse:
    """Kembalikan envelope error yang terstandarisasi."""
    body: dict = {"success": False, "error": {"message": message}}
    if detail is not None:         # tambahkan detail error jika ada
        body["error"]["detail"] = detail
    return JSONResponse(content=body, status_code=status_code)
    # Contoh output: {"success": false, "error": {"message": "Not found"}}
```

---

### `backend/app/main.py`

Entry point aplikasi FastAPI — di sinilah server dimulai.

```python
import oracledb
from contextlib import asynccontextmanager  # untuk lifespan context manager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_pool, close_pool, get_db, get_pool_stats
from app.responses import success_response, error_response
from app.routers import documents  # import router documents

# ---------------------------------------------------------------------------
# Lifespan: dijalankan saat server start dan stop
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kode SEBELUM yield → dijalankan saat startup
    print("🚀 Starting up: Creating connection pool...")
    create_pool()        # buat pool koneksi Oracle
    yield                # ← server berjalan di sini
    # Kode SETELAH yield → dijalankan saat shutdown
    print("🛑 Shutting down: Closing connection pool...")
    close_pool()         # tutup semua koneksi


# ---------------------------------------------------------------------------
# Inisialisasi aplikasi FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Gamma Oracle API",
    description="...",   # deskripsi tampil di /docs (Swagger UI)
    version="1.0.0",
    lifespan=lifespan,   # hubungkan ke lifespan yang sudah dibuat
)

# Middleware CORS — izinkan frontend (localhost:3000) memanggil backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # * = izinkan semua origin (untuk development)
    allow_credentials=False,
    allow_methods=["*"],      # izinkan semua HTTP method (GET, POST, dll)
    allow_headers=["*"],      # izinkan semua HTTP header
)

# Daftarkan router documents ke aplikasi
app.include_router(documents.router)  # semua endpoint di документы.py aktif

# ---------------------------------------------------------------------------
# Endpoint health check
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
def read_root():
    # Endpoint paling sederhana — konfirmasi bahwa server berjalan
    return {"message": "Gamma Oracle API is running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health_check():
    # Cek apakah aplikasi berjalan (tanpa menyentuh DB)
    return success_response(data={"status": "ok"})


@app.get("/health/db", tags=["Health"])
def db_health_check(conn=Depends(get_db)):  # Depends(get_db) = inject koneksi DB
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM DUAL")  # query Oracle paling ringan
        result = cursor.fetchone()            # ambil satu baris hasil
        cursor.close()
        pool_stats = get_pool_stats()         # ambil statistik pool
        return success_response(
            data={
                "status": "healthy",
                "database": "connected",
                "result": result[0],          # hasil SELECT 1 → 1
                "pool": pool_stats,
            }
        )
    except Exception as e:
        return error_response(f"Database unhealthy: {str(e)}", status_code=503)
```

---

### `backend/app/routers/documents.py`

File terpanjang — berisi semua **5 endpoint CRUD** untuk resource documents.

#### Bagian 1: Import & Setup

```python
import oracledb
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import get_db
from app.responses import success_response, error_response

# Semua endpoint di file ini punya prefix /v1/documents dan tag "Documents"
router = APIRouter(prefix="/v1/documents", tags=["Documents"])
```

#### Bagian 2: Validasi nilai yang diizinkan

```python
VALID_CATEGORIES = {"POLICY", "REPORT", "MEMO"}   # set Python → O(1) lookup
VALID_STATUSES   = {"ACTIVE", "DRAFT", "DELETED"}
```

#### Bagian 3: Pydantic Schema (validasi request body)

```python
class DocumentCreate(BaseModel):
    document_code: str = Field(..., min_length=1, max_length=50)
    # ... = wajib diisi, tidak boleh kosong, max 50 karakter
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None        # boleh tidak diisi
    category: Optional[str] = Field(None, pattern="^(POLICY|REPORT|MEMO)$")
    # pattern = regex validation, hanya 3 nilai ini yang lolos
    status: Optional[str] = Field("ACTIVE", pattern="^(ACTIVE|DRAFT)$")
    # default "ACTIVE" jika tidak diisi saat create


class DocumentUpdate(BaseModel):
    # Semua field Optional — partial update (PATCH-like via PUT)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(POLICY|REPORT|MEMO)$")
    status: Optional[str] = Field(None, pattern="^(ACTIVE|DRAFT|DELETED)$")
    # Update boleh set status ke DELETED (soft delete via form)
```

#### Bagian 4: Helper `_row_to_dict`

```python
def _row_to_dict(row) -> dict:
    # row = tuple dari fetchone/fetchall, urutan sesuai SELECT
    content = row[3]  # kolom ke-4 = content (CLOB)
    if content is not None and hasattr(content, "read"):
        content = content.read()
    # Oracle mengembalikan CLOB sebagai objek LOB, bukan string
    # hasattr(content, "read") mengecek apakah itu LOB object
    # .read() mengkonversi LOB → string Python

    return {
        "id":            row[0],   # NUMBER
        "document_code": row[1],   # VARCHAR2(50)
        "title":         row[2],   # VARCHAR2(200)
        "content":       content,  # CLOB → string
        "category":      row[4],   # VARCHAR2(20)
        "status":        row[5],   # VARCHAR2(20)
        "created_at":    row[6].isoformat() if row[6] else None,
        # .isoformat() → "2026-03-04T10:00:00" (format ISO 8601)
    }
```

#### Bagian 5: GET `/v1/documents` — List + Pagination

```python
@router.get("")  # "" → prefix sudah /v1/documents, jadi endpoint = GET /v1/documents
def list_documents(
    page: int = Query(1, ge=1),            # query param ?page=, min 1
    page_size: int = Query(20, ge=1, le=100),  # ?page_size=, antara 1-100
    category: Optional[str] = Query(None), # ?category= opsional
    conn=Depends(get_db),                  # inject koneksi DB
):
    cursor = conn.cursor()
    try:
        query = "SELECT id, document_code, title, content, category, status, created_at FROM documents"
        params: dict = {}

        if category:
            if category.upper() not in VALID_CATEGORIES:
                return error_response("Invalid category...", status_code=400)
            query += " WHERE category = :category"  # named parameter Oracle (:nama)
            params["category"] = category.upper()

        query += " ORDER BY created_at DESC"  # terbaru di atas
        cursor.execute(query, params)         # eksekusi dengan parameter binding
        rows = cursor.fetchall()              # ambil semua baris sekaligus

        all_docs = [_row_to_dict(r) for r in rows]  # konversi setiap row ke dict

        # Pagination di Python (bukan di SQL — cocok untuk dataset kecil)
        total  = len(all_docs)
        offset = (page - 1) * page_size       # hitung indeks awal
        paginated = all_docs[offset : offset + page_size]  # slice list

        return success_response(
            data=paginated,
            meta={
                "total":       total,
                "page":        page,
                "page_size":   page_size,
                "total_pages": (total + page_size - 1) // page_size if total else 0,
                # rumus ceiling division tanpa import math
            },
        )
    except oracledb.DatabaseError as e:
        (err,) = e.args                       # unpack Oracle error
        return error_response(f"Database error: {err.message}", status_code=500)
    except Exception as e:
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()  # SELALU tutup cursor, bahkan jika error
```

#### Bagian 6: GET `/v1/documents/{document_id}` — Single Document

```python
@router.get("/{document_id}")  # {document_id} = path parameter
def get_document(document_id: int, conn=Depends(get_db)):
    # FastAPI otomatis parse & validasi document_id sebagai integer
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT ... FROM documents WHERE id = :id",
            {"id": document_id},  # named parameter → aman dari SQL injection
        )
        row = cursor.fetchone()     # ambil satu baris
        if row is None:
            return error_response("Document not found", status_code=404)
        return success_response(data=_row_to_dict(row))
    ...
```

#### Bagian 7: POST `/v1/documents` — Create

```python
@router.post("", status_code=201)  # 201 Created adalah HTTP status untuk resource baru
def create_document(document: DocumentCreate, conn=Depends(get_db)):
    # document: DocumentCreate → FastAPI otomatis parse & validasi request body JSON
    cursor = conn.cursor()
    try:
        # Cek duplikasi kode dokumen
        cursor.execute("SELECT COUNT(*) FROM documents WHERE document_code = :code", ...)
        if cursor.fetchone()[0] > 0:           # COUNT(*) > 0 = sudah ada
            return error_response("document_code already exists", status_code=400)

        # INSERT dengan named parameter — AMAN dari SQL injection
        cursor.execute("""
            INSERT INTO documents (document_code, title, content, category, status, created_at)
            VALUES (:document_code, :title, :content, :category, :status, SYSTIMESTAMP)
            """, {
            "document_code": document.document_code,
            "title":         document.title,
            "content":       document.content,
            "category":      document.category.upper() if document.category else None,
            "status":        document.status or "ACTIVE",
        })

        # Ambil ID yang baru dibuat dari sequence CURRVAL
        cursor.execute("SELECT documents_seq.CURRVAL FROM DUAL")
        new_id = cursor.fetchone()[0]  # CURRVAL = nilai terakhir sequence di session ini

        conn.commit()  # simpan perubahan ke DB (WAJIB untuk DML)

        # Fetch ulang data lengkap untuk dikembalikan ke client
        cursor.execute("SELECT ... FROM documents WHERE id = :id", {"id": new_id})
        row = cursor.fetchone()
        return success_response(data=_row_to_dict(row), message="Document created successfully", status_code=201)

    except HTTPException:
        conn.rollback(); raise          # kalau ada HTTPException, rollback dulu
    except oracledb.IntegrityError as e:
        conn.rollback()                 # rollback jika constraint dilanggar
        return error_response(f"Data integrity error: {str(e)}", status_code=400)
    except Exception as e:
        conn.rollback()                 # SELALU rollback jika ada error
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()
```

#### Bagian 8: PUT `/v1/documents/{document_id}` — Update

```python
@router.put("/{document_id}")
def update_document(document_id: int, document: DocumentUpdate, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        # Verifikasi dokumen ada
        cursor.execute("SELECT COUNT(*) FROM documents WHERE id = :id", ...)
        if cursor.fetchone()[0] == 0:
            return error_response("Document not found", status_code=404)

        # Build UPDATE dinamis — hanya field yang dikirim yang di-update
        updates: List[str] = []
        params:  dict = {"id": document_id}

        if document.title is not None:
            updates.append("title = :title")    # tambah ke list SET clause
            params["title"] = document.title
        if document.content is not None:
            updates.append("content = :content")
            params["content"] = document.content
        if document.category is not None:
            updates.append("category = :category")
            params["category"] = document.category.upper()
        if document.status is not None:
            updates.append("status = :status")
            params["status"] = document.status.upper()

        if not updates:                         # tidak ada field yang dikirim
            return error_response("No fields to update", status_code=400)

        query = f"UPDATE documents SET {', '.join(updates)} WHERE id = :id"
        # Contoh: "UPDATE documents SET title = :title, status = :status WHERE id = :id"
        cursor.execute(query, params)
        conn.commit()

        # Kembalikan data terbaru
        cursor.execute("SELECT ... FROM documents WHERE id = :id", {"id": document_id})
        row = cursor.fetchone()
        return success_response(data=_row_to_dict(row), message="Document updated successfully")
    ...
```

#### Bagian 9: DELETE `/v1/documents/{document_id}` — Soft Delete

```python
@router.delete("/{document_id}")
def delete_document(document_id: int, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM documents WHERE id = :id", ...)
        if cursor.fetchone()[0] == 0:
            return error_response("Document not found", status_code=404)

        # SOFT DELETE — tidak hapus baris, hanya ubah status
        cursor.execute(
            "UPDATE documents SET status = 'DELETED' WHERE id = :id",
            {"id": document_id},
        )
        conn.commit()
        return success_response(
            data={"id": document_id},
            message=f"Document {document_id} deleted successfully",
        )
    except Exception as e:
        conn.rollback()
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()
```

> **Kenapa soft delete?** Data tetap tersimpan di DB untuk audit trail. Dokumen dengan status `DELETED` tidak hilang dari database, hanya "tersembunyi" dari tampilan normal.

---

## ⚡ FRONTEND

---

### `frontend/lib/api.js`

**API client terpusat** — satu-satunya tempat semua `fetch` ke backend dilakukan.

```javascript
/**
 * Centralized API client
 * Wraps all fetch calls to the FastAPI backend.
 */

// Ambil base URL dari environment variable (NEXT_PUBLIC_ = exposed ke browser)
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
// Jika .env.local tidak ada, fallback ke localhost:8000

// Fungsi internal — tidak di-export, hanya dipakai di dalam file ini
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;  // gabung base + path
  const config = {
    headers: {
      'Content-Type': 'application/json',  // selalu kirim JSON
      ...options.headers,                  // merge dengan header custom jika ada
    },
    ...options,  // spread sisa options (method, body, dll)
  };

  try {
    const response = await fetch(url, config);  // HTTP request
    const data = await response.json();         // parse body sebagai JSON

    if (!response.ok) {
      // response.ok = true jika status 200-299
      // Ambil pesan error dari envelope backend jika ada
      const message =
        data?.error?.message ||   // format envelope kita: {error: {message: "..."}}
        data?.detail ||           // format error FastAPI default
        `HTTP error ${response.status}`;
      throw new Error(message);
    }

    return data;  // kembalikan seluruh respons (termasuk success, data, meta)
  } catch (error) {
    console.error('API Error:', error);
    throw error;  // lempar ulang agar komponen bisa handle
  }
}

// ---------------------------------------------------------------------------
// Objek documentsApi — satu objek dengan semua method CRUD
// ---------------------------------------------------------------------------

export const documentsApi = {
  // GET /v1/documents?page=1&page_size=10&category=POLICY
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    // URLSearchParams: {page: 1, page_size: 10} → "page=1&page_size=10"
    return apiFetch(`/v1/documents${query ? `?${query}` : ''}`);
  },

  // GET /v1/documents/42
  get: async (id) => apiFetch(`/v1/documents/${id}`),

  // POST /v1/documents dengan body JSON
  create: async (docData) =>
    apiFetch('/v1/documents', {
      method: 'POST',
      body: JSON.stringify(docData),  // konversi object ke string JSON
    }),

  // PUT /v1/documents/42 dengan body JSON
  update: async (id, docData) =>
    apiFetch(`/v1/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(docData),
    }),

  // DELETE /v1/documents/42
  delete: async (id) =>
    apiFetch(`/v1/documents/${id}`, { method: 'DELETE' }),
};
```

---

### `frontend/app/layout.js`

Layout global yang **membungkus setiap halaman** — navbar selalu tampil.

```jsx
import './globals.css';   // CSS global (styling semua halaman)
import Link from 'next/link';  // komponen Link Next.js (client-side navigation)

// Metadata SEO — tampil di tab browser dan hasil Google
export const metadata = {
  title: 'Gamma Oracle — Pelatihan Hari 3',
  description: 'Aplikasi CRUD Full-Stack: FastAPI + Oracle Database + Next.js 15',
};

// RootLayout membungkus semua halaman — children = konten halaman aktif
export default function RootLayout({ children }) {
  return (
    <html lang="id">       {/* bahasa Indonesia untuk aksesibilitas */}
      <body>
        <nav className="navbar">
          {/* Brand logo + nama app, klik → kembali ke beranda */}
          <Link href="/" className="navbar-brand">
            <div className="brand-icon">Γ</div>  {/* huruf Gamma (Γ) */}
            <span>Gamma Oracle</span>
          </Link>

          <ul className="navbar-nav">
            <li>
              {/* Link ke halaman list dokumen */}
              <Link href="/documents" className="nav-link" id="nav-documents">
                📄 Documents
              </Link>
            </li>
            <li>
              {/* Tombol buat dokumen baru — styling btn-primary */}
              <Link href="/documents/new" className="btn btn-primary" id="nav-new-doc">
                + New Document
              </Link>
            </li>
          </ul>
        </nav>

        {/* Render konten halaman yang aktif */}
        <main>{children}</main>
      </body>
    </html>
  );
}
```

---

### `frontend/app/page.js`

Halaman beranda (`/`) — landing page yang menjelaskan fitur aplikasi.

```jsx
'use client';         // direktif Next.js: render di browser (bukan server)
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="hero">
        {/* Tag label kecil di atas judul */}
        <div className="hero-tag">✨ Hari 3 Pelatihan · FastAPI + Oracle + Next.js</div>

        <h1>
          Integrasi Oracle Database<br />
          & <span>Frontend Next.js</span>  {/* span untuk styling warna berbeda */}
        </h1>

        <p>Deskripsi singkat aplikasi...</p>

        {/* Tombol CTA (Call-to-Action) */}
        <div className="hero-actions">
          <Link href="/documents" className="btn btn-primary" id="btn-view-documents">
            📄 Lihat Dokumen
          </Link>
          <Link href="/documents/new" className="btn btn-secondary" id="btn-create-doc">
            + Buat Dokumen Baru
          </Link>
        </div>

        {/* Grid 4 kartu fitur teknis */}
        <div className="feature-grid">
          <div className="feature-card">
            <div className="icon">🔌</div>
            <h3>Connection Pooling</h3>
            <p>Reuse koneksi Oracle untuk performa optimal — min 2, max 10.</p>
          </div>
          {/* ... 3 kartu lainnya: Parameter Binding, Transaction Management, Next.js */}
        </div>
      </div>
    </div>
  );
}
```

---

### `frontend/app/documents/page.js`

Halaman list dokumen (`/documents`) — tabel dengan filter, pagination, dan aksi hapus.

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';  // @ = alias untuk root project (jsconfig.json)

// Komponen helper untuk badge warna berdasarkan nilai
function Badge({ value, type }) {
  if (!value) return <span ...>—</span>;     // tampilkan dash jika kosong
  const map = {                              // mapping nilai → CSS class
    POLICY: 'badge-policy',
    REPORT: 'badge-report',
    MEMO:   'badge-memo',
    ACTIVE: 'badge-active',
    DRAFT:  'badge-draft',
    DELETED:'badge-deleted',
  };
  return <span className={`badge ${map[value] || ''}`}>{value}</span>;
}

export default function DocumentsPage() {
  // State management
  const [documents, setDocuments] = useState([]);   // array dokumen
  const [loading, setLoading]     = useState(true);  // loading indicator
  const [error, setError]         = useState(null);  // pesan error
  const [page, setPage]           = useState(1);     // halaman aktif pagination
  const [meta, setMeta]           = useState(null);  // info pagination dari API
  const [category, setCategory]   = useState('');    // filter kategori
  const PAGE_SIZE = 10;

  // useCallback: fungsi fetch yang di-memoize, hanya dibuat ulang jika page/category berubah
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (category) params.category = category;    // tambah filter jika dipilih
      const response = await documentsApi.list(params);
      setDocuments(response.data || []);
      setMeta(response.meta || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);  // selalu matikan loading
    }
  }, [page, category]);  // dependency array: re-create jika salah satu berubah

  // useEffect: panggil fetchDocuments setiap kali fetchDocuments berubah
  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // Handler hapus dokumen (dengan konfirmasi)
  async function handleDelete(id) {
    if (!confirm(`Yakin ingin menghapus dokumen #${id}?`)) return;  // browser confirm dialog
    try {
      await documentsApi.delete(id);
      fetchDocuments();  // refresh list setelah hapus
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  }

  const totalPages = meta?.total_pages ?? 1;  // optional chaining + nullish coalescing

  return (
    <div className="page-container">
      {/* Toolbar: filter kategori + tombol aksi */}
      <div className="toolbar">
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          // Reset ke page 1 setiap ganti filter agar tidak muncul halaman kosong
        >
          <option value="">Semua Kategori</option>
          <option value="POLICY">POLICY</option>
          ...
        </select>
        {meta && <span>{meta.total} dokumen ditemukan</span>}
      </div>

      {/* Tampilkan error jika ada */}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Tampilkan spinner saat loading */}
      {loading && <div className="loading-center"><div className="spinner" /></div>}

      {/* Tabel hanya tampil jika tidak loading dan tidak error */}
      {!loading && !error && (
        <>
          <table id="documents-table">
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan="6"><div className="empty-state">...</div></td></tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} id={`doc-row-${doc.id}`}>
                    {/* ... kolom data ... */}
                    <td>
                      {/* Format tanggal: "04 Mar 2026" */}
                      {new Date(doc.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td>
                      <Link href={`/documents/${doc.id}`}>✏️ Edit</Link>
                      <button onClick={() => handleDelete(doc.id)}>🗑 Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination: tampil hanya jika > 1 halaman */}
          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {/* Buat tombol angka untuk setiap halaman */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

---

### `frontend/app/documents/new/page.js`

Halaman form buat dokumen baru (`/documents/new`).

```jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';  // untuk redirect programatik
import Link from 'next/link';
import { documentsApi } from '@/lib/api';

// Nilai awal form — dipisah sebagai konstanta agar mudah di-reset
const INITIAL_FORM = {
  document_code: '',
  title: '',
  content: '',
  category: 'REPORT',   // default
  status: 'ACTIVE',     // default
};

export default function CreateDocumentPage() {
  const router = useRouter();  // akses Next.js router untuk redirect
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Handler generik untuk semua input/select/textarea
  function handleChange(e) {
    const { name, value } = e.target;  // destructure nama field dan nilainya
    setFormData(prev => ({ ...prev, [name]: value }));
    // spread prev state + update hanya field yang berubah
  }

  async function handleSubmit(e) {
    e.preventDefault();    // cegah browser reload halaman (default form behavior)
    setLoading(true);
    setError(null);
    try {
      await documentsApi.create(formData);   // POST ke /v1/documents
      router.push('/documents');             // redirect ke list setelah berhasil
    } catch (err) {
      setError(err.message);  // tampilkan pesan error dari backend
      setLoading(false);      // matikan loading (tidak redirect)
    }
  }

  return (
    <div className="page-container form-page">
      {/* Tampilkan alert error jika ada */}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <form id="create-document-form" onSubmit={handleSubmit}>
        {/* Field document_code — required, max 50 char */}
        <input
          id="document_code"
          name="document_code"
          type="text"
          value={formData.document_code}
          onChange={handleChange}
          required          // validasi HTML5 native
          maxLength={50}    // validasi HTML5 native
        />

        {/* ... field title, category, status, content ... */}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? '⏳ Menyimpan…' : '💾 Simpan Dokumen'}
            {/* Ubah teks tombol saat loading untuk feedback visual */}
          </button>
          <Link href="/documents">Batal</Link>  {/* kembali tanpa menyimpan */}
        </div>
      </form>
    </div>
  );
}
```

---

### `frontend/app/documents/[id]/page.js`

Halaman edit dokumen (`/documents/42`) — `[id]` adalah **dynamic route** Next.js.

```jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';

export default function EditDocumentPage() {
  const router = useRouter();
  const params = useParams();    // akses URL params
  const docId  = params.id;     // ambil nilai [id] dari URL (/documents/42 → "42")

  // Dua state loading terpisah:
  const [fetchLoading, setFetchLoading] = useState(true);   // loading data awal
  const [loading, setLoading]           = useState(false);  // loading saat submit
  const [error, setError]               = useState(null);
  const [formData, setFormData]         = useState({
    title: '', content: '', category: 'REPORT', status: 'ACTIVE',
  });

  // useEffect: fetch data dokumen saat halaman pertama dibuka
  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await documentsApi.get(docId);  // GET /v1/documents/42
        const doc = response.data || response;
        setFormData({
          title:    doc.title    || '',
          content:  doc.content  || '',
          category: doc.category || 'REPORT',
          status:   doc.status   || 'ACTIVE',
        });
        // Pre-populate form dengan data dari database
      } catch (err) {
        setError(`Gagal memuat dokumen: ${err.message}`);
      } finally {
        setFetchLoading(false);  // selesai loading awal
      }
    }
    fetchDocument();
  }, [docId]);  // re-run jika docId berubah (navigasi antar edit page)

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await documentsApi.update(docId, formData);  // PUT /v1/documents/42
      router.push('/documents');                   // redirect ke list
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Soft delete dari halaman edit
  async function handleDelete() {
    if (!confirm(`Yakin ingin menghapus dokumen #${docId}?`)) return;
    try {
      await documentsApi.delete(docId);   // DELETE /v1/documents/42
      router.push('/documents');          // redirect ke list
    } catch (err) {
      setError(`Gagal menghapus: ${err.message}`);
    }
  }

  // Tampilkan spinner sampai data awal selesai di-fetch
  if (fetchLoading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
        <span>Memuat data dokumen…</span>
      </div>
    );
  }

  return (
    <div className="page-container form-page">
      <h1>✏️ Edit Dokumen #{docId}</h1>

      <form id="edit-document-form" onSubmit={handleSubmit}>
        {/* Form field sama seperti create, tapi sudah terisi dari database */}
        
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? '⏳ Menyimpan…' : '💾 Simpan Perubahan'}
          </button>
          <Link href="/documents">Batal</Link>

          {/* Tombol hapus ada di halaman edit juga */}
          <button type="button" onClick={handleDelete}>
            🗑 Hapus Dokumen
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Ringkasan Alur Data

```
Browser                    Frontend (Next.js)         Backend (FastAPI)       Database (Oracle)
  │                              │                          │                       │
  │── klik "Lihat Dokumen" ──→  │                          │                       │
  │                         fetch /v1/documents ──────────→│                       │
  │                              │                    pool.acquire()  ────────────→│
  │                              │                          │           SELECT ...  │
  │                              │                          │←── rows ─────────────│
  │                              │                    pool.release()               │
  │                              │←── JSON response ────────│                       │
  │←── render tabel ────────────│                          │                       │
```

---

*Dokumentasi dibuat oleh Antigravity · Gamma Oracle Training Day 3*
