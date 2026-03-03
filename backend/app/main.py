import oracledb
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_pool, close_pool, get_db, get_pool_stats
from app.responses import success_response, error_response
from app.routers import documents


# ---------------------------------------------------------------------------
# Lifespan: create pool on startup, close on shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting up: Creating connection pool...")
    create_pool()
    yield
    print("🛑 Shutting down: Closing connection pool...")
    close_pool()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Gamma Oracle API",
    description=(
        "Hari 3 Training — FastAPI + Oracle Database. "
        "Full CRUD untuk resource Documents dengan Connection Pooling, "
        "Transaction Management, dan Parameter Binding."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local dev / training
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(documents.router)


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Gamma Oracle API is running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health_check():
    return success_response(data={"status": "ok"})


@app.get("/health/db", tags=["Health"])
def db_health_check(conn=Depends(get_db)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        result = cursor.fetchone()
        cursor.close()
        pool_stats = get_pool_stats()
        return success_response(
            data={
                "status": "healthy",
                "database": "connected",
                "result": result[0],
                "pool": pool_stats,
            }
        )
    except Exception as e:
        return error_response(f"Database unhealthy: {str(e)}", status_code=503)
