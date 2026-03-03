# Cara Melihat Tabel DOCUMENTS di Oracle

## 1. DBeaver

### Buka Data Langsung dari Tree

1. Di panel kiri **Database Navigator**, expand koneksi `system@freepdb1`
2. Expand **Schemas** → **SYSTEM** → **Tables**
3. Klik kanan tabel **DOCUMENTS** → **View Data**

> Tabel langsung terbuka dengan semua isi data dalam tab **Data**.

### Query Manual di SQL Editor

1. Klik kanan koneksi → **SQL Editor** → **New SQL Script**
2. Ketik salah satu query berikut, lalu tekan **Ctrl+Enter** (atau **Ctrl+Shift+Enter** untuk semua):

```sql
-- Lihat semua data
SELECT * FROM documents;

-- Hanya beberapa kolom
SELECT id, document_code, title, category, status, created_at
FROM documents
ORDER BY created_at DESC;

-- Filter by status
SELECT * FROM documents WHERE status = 'ACTIVE';

-- Lihat struktur tabel
DESCRIBE documents;

-- Hitung jumlah baris
SELECT COUNT(*) AS total FROM documents;
```

### Lihat Struktur Tabel (DDL)

1. Klik kanan **DOCUMENTS** di tree → **View Table**
2. Tab **Columns** → lihat semua kolom + tipe data
3. Tab **DDL** → lihat CREATE TABLE yang di-generate otomatis

---

## 2. SQL*Plus (Terminal)

### Koneksi ke Database

```bash
# Format: sqlplus user/password@host:port/service
sqlplus system/password@localhost:1521/freepdb1
```

Jika berhasil, muncul prompt:
```
SQL>
```

### Query yang Berguna

```sql
-- Tampilkan semua kolom (view lebih rapi)
SET LINESIZE 200
SET PAGESIZE 50
COL document_code FORMAT A15
COL title         FORMAT A30
COL category      FORMAT A10
COL status        FORMAT A10

SELECT id, document_code, title, category, status FROM documents;

-- Lihat semua tabel milik user saat ini
SELECT table_name FROM user_tables;

-- Lihat struktur tabel
DESCRIBE documents;

-- Hitung data
SELECT COUNT(*) FROM documents;

-- Keluar dari SQL*Plus
EXIT
```

### Contoh Output

```
SQL> SELECT id, document_code, title, category, status FROM documents;

        ID DOCUMENT_CODE   TITLE                          CATEGORY   STATUS
---------- --------------- ------------------------------ ---------- ----------
         1 DOC-001         Kebijakan Anggaran 2026        POLICY     ACTIVE
         2 DOC-002         Laporan Keuangan Q1            REPORT     ACTIVE
         3 DOC-003         Memo Koordinasi Internal       MEMO       DRAFT
```

---

## Tips

| Kebutuhan | DBeaver | SQL*Plus |
|-----------|---------|---------|
| Lihat data visual | ✅ Mudah, klik kanan → View Data | ❌ Perlu format manual |
| Edit data langsung | ✅ Bisa double-click cell | ❌ Harus UPDATE statement |
| Export ke CSV/Excel | ✅ Built-in export | ❌ Perlu SPOOL |
| Query cepat | ✅ SQL Editor | ✅ Prompt langsung |
| Lihat DDL / struktur | ✅ Tab DDL | ✅ `DESCRIBE table` |
