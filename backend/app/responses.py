from typing import Any, Optional
from fastapi.responses import JSONResponse


def success_response(
    data: Any,
    message: Optional[str] = None,
    meta: Optional[dict] = None,
    status_code: int = 200,
) -> JSONResponse:
    """Return a standardized success envelope."""
    body: dict = {"success": True, "data": data}
    if message:
        body["message"] = message
    if meta:
        body["meta"] = meta
    return JSONResponse(content=body, status_code=status_code)


def error_response(
    message: str,
    status_code: int = 400,
    detail: Optional[Any] = None,
) -> JSONResponse:
    """Return a standardized error envelope."""
    body: dict = {"success": False, "error": {"message": message}}
    if detail is not None:
        body["error"]["detail"] = detail
    return JSONResponse(content=body, status_code=status_code)
