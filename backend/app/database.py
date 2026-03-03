import oracledb
from typing import Generator
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("ORACLE_USER", "training_user")
DB_PASSWORD = os.getenv("ORACLE_PASSWORD", "SecurePass123")
DB_DSN = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")

# Pool configuration
POOL_MIN = 2
POOL_MAX = 10
POOL_INCREMENT = 1

_pool = None


def create_pool():
    """Create and initialize the Oracle connection pool."""
    global _pool
    try:
        _pool = oracledb.create_pool(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            min=POOL_MIN,
            max=POOL_MAX,
            increment=POOL_INCREMENT,
            getmode=oracledb.POOL_GETMODE_WAIT,
        )
        print(
            f"✅ Connection pool created: {POOL_MIN}–{POOL_MAX} connections "
            f"| DSN: {DB_DSN}"
        )
        return _pool
    except oracledb.Error as e:
        (error,) = e.args
        print(f"❌ Failed to create pool: {error.message}")
        raise


def get_pool():
    """Return the existing pool, creating it if necessary."""
    global _pool
    if _pool is None:
        _pool = create_pool()
    return _pool


def get_db() -> Generator:
    """
    FastAPI dependency: acquire a connection from the pool,
    yield it to the route handler, then return it to the pool.
    """
    pool = get_pool()
    connection = pool.acquire()
    try:
        yield connection
    finally:
        connection.close()  # Returns connection to pool


def close_pool():
    """Drain and close the pool on application shutdown."""
    global _pool
    if _pool is not None:
        _pool.close()
        print("🔒 Connection pool closed")
        _pool = None


def get_pool_stats() -> dict:
    """Return a snapshot of pool utilisation metrics."""
    pool = get_pool()
    return {
        "opened": pool.opened,
        "busy": pool.busy,
        "available": pool.opened - pool.busy,
        "max": pool.max,
        "min": pool.min,
    }
