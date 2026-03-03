"""
Quick setup script — creates the DOCUMENTS table in Oracle.
Run from the backend directory with the venv active:
  python setup_db.py
"""
import oracledb
from dotenv import load_dotenv
import os

load_dotenv()

conn = oracledb.connect(
    user=os.getenv("ORACLE_USER", "system"),
    password=os.getenv("ORACLE_PASSWORD", "password"),
    dsn=os.getenv("ORACLE_DSN", "localhost:1521/freepdb1"),
)
cursor = conn.cursor()

statements = [
    # Drop if re-running
    """BEGIN
         EXECUTE IMMEDIATE 'DROP SEQUENCE documents_seq';
       EXCEPTION WHEN OTHERS THEN NULL;
       END;""",
    """BEGIN
         EXECUTE IMMEDIATE 'DROP TABLE documents CASCADE CONSTRAINTS';
       EXCEPTION WHEN OTHERS THEN NULL;
       END;""",

    # Sequence
    """CREATE SEQUENCE documents_seq
         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE""",

    # Table
    """CREATE TABLE documents (
         id            NUMBER          NOT NULL,
         document_code VARCHAR2(50)    NOT NULL,
         title         VARCHAR2(200)   NOT NULL,
         content       CLOB,
         category      VARCHAR2(20),
         status        VARCHAR2(20)    DEFAULT 'ACTIVE' NOT NULL,
         created_at    TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
         CONSTRAINT pk_documents       PRIMARY KEY (id),
         CONSTRAINT uq_document_code   UNIQUE (document_code),
         CONSTRAINT chk_category       CHECK (category IN ('POLICY','REPORT','MEMO')),
         CONSTRAINT chk_status         CHECK (status   IN ('ACTIVE','DRAFT','DELETED'))
       )""",

    # Trigger for auto PK
    """CREATE OR REPLACE TRIGGER trg_documents_pk
         BEFORE INSERT ON documents
         FOR EACH ROW
       BEGIN
         IF :NEW.id IS NULL THEN
           SELECT documents_seq.NEXTVAL INTO :NEW.id FROM DUAL;
         END IF;
       END;""",

    # Seed data
    """INSERT INTO documents (document_code, title, content, category, status)
       VALUES ('DOC-001', 'Kebijakan Anggaran 2026',
               'Isi kebijakan anggaran tahun 2026.', 'POLICY', 'ACTIVE')""",

    """INSERT INTO documents (document_code, title, content, category, status)
       VALUES ('DOC-002', 'Laporan Keuangan Q1',
               'Laporan keuangan kuartal pertama.', 'REPORT', 'ACTIVE')""",

    """INSERT INTO documents (document_code, title, content, category, status)
       VALUES ('DOC-003', 'Memo Koordinasi Internal',
               'Informasi koordinasi tim internal.', 'MEMO', 'DRAFT')""",
]

for sql in statements:
    cursor.execute(sql)
    print(f"✅ OK: {sql.strip()[:60]}...")

conn.commit()
cursor.close()
conn.close()
print("\n🎉 Database setup complete! Table DOCUMENTS created with 3 seed rows.")
