-- ============================================================
-- Hari 3 Training — Oracle DDL for DOCUMENTS resource
-- Connect as: system / password  →  localhost:1521/freepdb1
-- Run in SQL*Plus, DBeaver, or SQLcl before starting the backend.
-- ============================================================

-- 1. Sequence for auto-increment primary key
CREATE SEQUENCE documents_seq
  START WITH 1
  INCREMENT BY 1
  NOCACHE
  NOCYCLE;

-- 2. Table
CREATE TABLE documents (
  id            NUMBER          NOT NULL,
  document_code VARCHAR2(50)    NOT NULL,
  title         VARCHAR2(200)   NOT NULL,
  content       CLOB,
  category      VARCHAR2(20),   -- POLICY | REPORT | MEMO
  status        VARCHAR2(20)    DEFAULT 'ACTIVE' NOT NULL,  -- ACTIVE | DRAFT | DELETED
  created_at    TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,

  CONSTRAINT pk_documents PRIMARY KEY (id),
  CONSTRAINT uq_document_code UNIQUE (document_code),
  CONSTRAINT chk_category CHECK (category IN ('POLICY', 'REPORT', 'MEMO')),
  CONSTRAINT chk_status   CHECK (status   IN ('ACTIVE', 'DRAFT', 'DELETED'))
);

-- 3. Trigger: auto-populate id from sequence before insert
CREATE OR REPLACE TRIGGER trg_documents_pk
  BEFORE INSERT ON documents
  FOR EACH ROW
BEGIN
  IF :NEW.id IS NULL THEN
    SELECT documents_seq.NEXTVAL
    INTO   :NEW.id
    FROM   DUAL;
  END IF;
END;
/

-- 4. (Optional) seed data for testing
INSERT INTO documents (document_code, title, content, category, status)
VALUES ('DOC-001', 'Kebijakan Anggaran 2026', 'Isi kebijakan anggaran tahun 2026.', 'POLICY', 'ACTIVE');

INSERT INTO documents (document_code, title, content, category, status)
VALUES ('DOC-002', 'Laporan Keuangan Q1', 'Laporan keuangan kuartal pertama.', 'REPORT', 'ACTIVE');

INSERT INTO documents (document_code, title, content, category, status)
VALUES ('DOC-003', 'Memo Koordinasi Internal', 'Informasi koordinasi tim internal.', 'MEMO', 'DRAFT');

COMMIT;
