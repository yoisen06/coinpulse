"""CoinPulse - Flask routes."""
import logging

import psycopg2
from flask import Flask, jsonify, render_template, request

import database
import market

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = Flask(__name__)
database.init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    if database.check_db():
        return jsonify(status="healthy", database="up"), 200
    return jsonify(status="unhealthy", database="down"), 503


@app.route("/api/market")
def api_market():
    try:
        coins = market.get_top_coins()
    except market.MarketError as exc:
        return jsonify(error=str(exc)), 503

    # The summary is optional: the dashboard still works without it.
    try:
        summary = market.get_global_summary()["data"]
    except market.MarketError:
        summary = None

    return jsonify(
        coins=coins["data"],
        summary=summary,
        updated_at=coins["updated_at"],
        stale=coins["stale"],
    )


@app.route("/api/watchlist", methods=["GET"])
def get_watchlist():
    return jsonify(database.list_watchlist())


@app.route("/api/watchlist", methods=["POST"])
def add_watchlist():
    body = request.get_json(silent=True)
    coin_id = body.get("coin_id") if isinstance(body, dict) else None
    if not isinstance(coin_id, str) or not coin_id.strip() or len(coin_id) > 100:
        return jsonify(error="'coin_id' is required (string)."), 400

    try:
        top = market.get_top_coins()["data"]
    except market.MarketError as exc:
        return jsonify(error=str(exc)), 503

    coin = next((c for c in top if c["id"] == coin_id.strip()), None)
    if coin is None:
        return jsonify(error="'coin_id' must be one of the current top 5 coins."), 400

    row = database.add_to_watchlist(coin["id"], coin["symbol"], coin["name"], coin["image"])
    if row is None:
        return jsonify(error="Coin is already in the watchlist."), 409
    return jsonify(row), 201


@app.route("/api/watchlist/<int:entry_id>", methods=["DELETE"])
def delete_watchlist(entry_id):
    if database.remove_from_watchlist(entry_id):
        return "", 204
    return jsonify(error="Watchlist entry not found."), 404


@app.errorhandler(psycopg2.Error)
def handle_db_error(exc):
    app.logger.error("Database error: %s", type(exc).__name__)
    return jsonify(error="Database unavailable."), 503
