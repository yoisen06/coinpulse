"""PostgreSQL helpers. All queries are parameterized (no string concatenation)."""
import logging
import os
import time
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

log = logging.getLogger("coinpulse.db")


def _connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),  # Compose service name
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=3,
    )


@contextmanager
def cursor():
    """Open a connection, commit on success, roll back on error, always close."""
    conn = _connect()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
    finally:
        conn.close()


def init_db(retries=10, delay=2):
    """Create the table if needed. Retries while PostgreSQL is starting."""
    for attempt in range(1, retries + 1):
        try:
            with cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS watchlist (
                        id         SERIAL PRIMARY KEY,
                        coin_id    VARCHAR(100) NOT NULL UNIQUE,
                        symbol     VARCHAR(20)  NOT NULL,
                        name       VARCHAR(100) NOT NULL,
                        image      TEXT,
                        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                    )
                    """
                )
            log.info("Database ready.")
            return
        except psycopg2.OperationalError:
            log.warning("Database not ready (attempt %d/%d)", attempt, retries)
            time.sleep(delay)
    raise RuntimeError("Could not connect to the database.")


def check_db():
    """Return True if the database answers a simple query."""
    try:
        with cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except psycopg2.Error:
        return False


def _serialize(row):
    row["created_at"] = row["created_at"].isoformat()
    return row


def list_watchlist():
    with cursor() as cur:
        cur.execute("SELECT * FROM watchlist ORDER BY created_at DESC")
        return [_serialize(r) for r in cur.fetchall()]


def add_to_watchlist(coin_id, symbol, name, image):
    """Insert a coin. Returns the new row, or None if it already exists."""
    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO watchlist (coin_id, symbol, name, image)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (coin_id) DO NOTHING
            RETURNING *
            """,
            (coin_id, symbol, name, image),
        )
        row = cur.fetchone()
        return _serialize(row) if row else None


def remove_from_watchlist(entry_id):
    """Delete an entry. Returns True if a row was deleted."""
    with cursor() as cur:
        cur.execute("DELETE FROM watchlist WHERE id = %s", (entry_id,))
        return cur.rowcount > 0
