"""CoinGecko client with a simple in-memory cache.

All CoinGecko requests happen here, on the server, so the API key
never reaches the browser.
"""
import logging
import os
import threading
import time
from datetime import datetime, timezone

import requests

log = logging.getLogger("coinpulse.market")

BASE_URL = "https://api.coingecko.com/api/v3"
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "60"))
REQUEST_TIMEOUT = 10  # seconds
RETRY_BACKOFF = 15    # seconds to wait before retrying after a failed request

_cache = {}  # name -> {"data": ..., "ts": float, "updated_at": str}
_retry_after = {}  # name -> time before which we will not call CoinGecko again
_lock = threading.Lock()


class MarketError(Exception):
    """Raised when CoinGecko fails and there is no cached data to fall back on."""


def _headers():
    headers = {"accept": "application/json"}
    api_key = os.getenv("COINGECKO_API_KEY", "").strip()
    # An empty or placeholder value (like the one in .env.example) means "no key":
    # CoinGecko rejects invalid keys, but serves the public endpoint without one.
    if api_key and not api_key.startswith("your_"):
        headers["x-cg-demo-api-key"] = api_key
    return headers


def _cached_fetch(name, path, params, transform):
    """Return fresh cached data, or fetch it. Falls back to stale cache on errors."""
    with _lock:
        entry = _cache.get(name)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return {"data": entry["data"], "updated_at": entry["updated_at"], "stale": False}

    # After a failure, don't hammer CoinGecko (or wait for timeouts) on every poll.
    if time.time() < _retry_after.get(name, 0):
        if entry:
            return {"data": entry["data"], "updated_at": entry["updated_at"], "stale": True}
        raise MarketError("Market data is currently unavailable.")

    try:
        response = requests.get(
            BASE_URL + path, params=params, headers=_headers(), timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        data = transform(response.json())
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        log.warning("CoinGecko request '%s' failed: %s", name, type(exc).__name__)
        _retry_after[name] = time.time() + RETRY_BACKOFF
        if entry:  # serve the last successful data, marked as stale
            return {"data": entry["data"], "updated_at": entry["updated_at"], "stale": True}
        raise MarketError("Market data is currently unavailable.") from exc

    updated_at = datetime.now(timezone.utc).isoformat()
    with _lock:
        _cache[name] = {"data": data, "ts": time.time(), "updated_at": updated_at}
    return {"data": data, "updated_at": updated_at, "stale": False}


def _clean_coin(c):
    return {
        "id": c["id"],
        "rank": c["market_cap_rank"],
        "name": c["name"],
        "symbol": c["symbol"].upper(),
        "image": c["image"],
        "price": c["current_price"],
        "change_24h": c.get("price_change_percentage_24h_in_currency"),
        "market_cap": c["market_cap"],
        "volume_24h": c["total_volume"],
    }


def get_top_coins():
    """Top 5 coins by market cap, priced in IDR."""
    params = {
        "vs_currency": "idr",
        "order": "market_cap_desc",
        "per_page": 5,
        "page": 1,
        "sparkline": "false",
        "price_change_percentage": "24h",
    }
    return _cached_fetch(
        "top_coins", "/coins/markets", params, lambda raw: [_clean_coin(c) for c in raw]
    )


def get_global_summary():
    """Global market stats (total market cap, volume, BTC dominance)."""

    def transform(raw):
        d = raw["data"]
        return {
            "total_market_cap": d["total_market_cap"]["idr"],
            "total_volume_24h": d["total_volume"]["idr"],
            "btc_dominance": d["market_cap_percentage"]["btc"],
            # CoinGecko reports this change in USD terms
            "market_cap_change_24h": d["market_cap_change_percentage_24h_usd"],
        }

    return _cached_fetch("global", "/global", None, transform)
