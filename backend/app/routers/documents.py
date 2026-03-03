import oracledb
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import get_db
from app.responses import success_response, error_response

router = APIRouter(prefix="/v1/documents", tags=["Documents"])

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"POLICY", "REPORT", "MEMO"}
VALID_STATUSES = {"ACTIVE", "DRAFT", "DELETED"}


class DocumentCreate(BaseModel):
    document_code: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(POLICY|REPORT|MEMO)$")
    status: Optional[str] = Field("ACTIVE", pattern="^(ACTIVE|DRAFT)$")


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(POLICY|REPORT|MEMO)$")
    status: Optional[str] = Field(None, pattern="^(ACTIVE|DRAFT|DELETED)$")


# ---------------------------------------------------------------------------
# Helper: row → dict
# ---------------------------------------------------------------------------

def _row_to_dict(row) -> dict:
    # row[3] is CLOB — Oracle returns a LOB object; call .read() to get a plain string
    content = row[3]
    if content is not None and hasattr(content, "read"):
        content = content.read()
    return {
        "id": row[0],
        "document_code": row[1],
        "title": row[2],
        "content": content,
        "category": row[4],
        "status": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }


# ---------------------------------------------------------------------------
# GET /v1/documents — List with pagination & category filter
# ---------------------------------------------------------------------------

@router.get("")
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    conn=Depends(get_db),
):
    cursor = conn.cursor()
    try:
        # Build query with optional category filter
        query = """
            SELECT id, document_code, title, content, category, status, created_at
            FROM documents
        """
        params: dict = {}

        if category:
            if category.upper() not in VALID_CATEGORIES:
                return error_response(
                    f"Invalid category. Valid values: {', '.join(VALID_CATEGORIES)}",
                    status_code=400,
                )
            query += " WHERE category = :category"
            params["category"] = category.upper()

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        all_docs = [_row_to_dict(r) for r in rows]

        # In-Python pagination
        total = len(all_docs)
        offset = (page - 1) * page_size
        paginated = all_docs[offset : offset + page_size]

        return success_response(
            data=paginated,
            meta={
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if total else 0,
            },
        )
    except oracledb.DatabaseError as e:
        (err,) = e.args
        return error_response(f"Database error: {err.message}", status_code=500)
    except Exception as e:
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# GET /v1/documents/{document_id} — Single document
# ---------------------------------------------------------------------------

@router.get("/{document_id}")
def get_document(document_id: int, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, document_code, title, content, category, status, created_at
            FROM documents
            WHERE id = :id
            """,
            {"id": document_id},
        )
        row = cursor.fetchone()
        if row is None:
            return error_response("Document not found", status_code=404)
        return success_response(data=_row_to_dict(row))
    except oracledb.DatabaseError as e:
        (err,) = e.args
        return error_response(f"Database error: {err.message}", status_code=500)
    except Exception as e:
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# POST /v1/documents — Create
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
def create_document(document: DocumentCreate, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        # Check for duplicate document_code
        cursor.execute(
            "SELECT COUNT(*) FROM documents WHERE document_code = :code",
            {"code": document.document_code},
        )
        if cursor.fetchone()[0] > 0:
            return error_response(
                "document_code already exists", status_code=400
            )

        # Insert — parameter binding prevents SQL injection
        cursor.execute(
            """
            INSERT INTO documents (document_code, title, content, category, status, created_at)
            VALUES (:document_code, :title, :content, :category, :status, SYSTIMESTAMP)
            """,
            {
                "document_code": document.document_code,
                "title": document.title,
                "content": document.content,
                "category": document.category.upper() if document.category else None,
                "status": document.status or "ACTIVE",
            },
        )

        # Retrieve generated ID from sequence CURRVAL
        cursor.execute("SELECT documents_seq.CURRVAL FROM DUAL")
        new_id = cursor.fetchone()[0]

        conn.commit()

        # Return the created record
        cursor.execute(
            """
            SELECT id, document_code, title, content, category, status, created_at
            FROM documents WHERE id = :id
            """,
            {"id": new_id},
        )
        row = cursor.fetchone()
        return success_response(
            data=_row_to_dict(row),
            message="Document created successfully",
            status_code=201,
        )

    except HTTPException:
        conn.rollback()
        raise
    except oracledb.IntegrityError as e:
        conn.rollback()
        return error_response(f"Data integrity error: {str(e)}", status_code=400)
    except Exception as e:
        conn.rollback()
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# PUT /v1/documents/{document_id} — Update
# ---------------------------------------------------------------------------

@router.put("/{document_id}")
def update_document(document_id: int, document: DocumentUpdate, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        # Verify document exists
        cursor.execute(
            "SELECT COUNT(*) FROM documents WHERE id = :id",
            {"id": document_id},
        )
        if cursor.fetchone()[0] == 0:
            return error_response("Document not found", status_code=404)

        # Build dynamic UPDATE — only set provided fields
        updates: List[str] = []
        params: dict = {"id": document_id}

        if document.title is not None:
            updates.append("title = :title")
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

        if not updates:
            return error_response("No fields to update", status_code=400)

        query = f"UPDATE documents SET {', '.join(updates)} WHERE id = :id"
        cursor.execute(query, params)
        conn.commit()

        # Return updated record
        cursor.execute(
            """
            SELECT id, document_code, title, content, category, status, created_at
            FROM documents WHERE id = :id
            """,
            {"id": document_id},
        )
        row = cursor.fetchone()
        return success_response(data=_row_to_dict(row), message="Document updated successfully")

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        return error_response(f"Unexpected error: {str(e)}", status_code=500)
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# DELETE /v1/documents/{document_id} — Soft delete (status = DELETED)
# ---------------------------------------------------------------------------

@router.delete("/{document_id}")
def delete_document(document_id: int, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM documents WHERE id = :id",
            {"id": document_id},
        )
        if cursor.fetchone()[0] == 0:
            return error_response("Document not found", status_code=404)

        # Soft delete: mark as DELETED, preserve data
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
