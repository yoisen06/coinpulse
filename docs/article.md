# Building CoinPulse: A Containerized Crypto Dashboard with Flask, PostgreSQL, and Docker Compose

*Winsen Cristiano Sun · Cloud Services project*

## Why I built CoinPulse

For my Docker and containerization assignment, I wanted a project that needed more than one container and talked to something outside my own code. A cryptocurrency dashboard fit well: it needs live data from an external API, a database to keep user data, and a web interface. CoinPulse shows the top five cryptocurrencies by market cap in Indonesian Rupiah, with a watchlist that stays saved between sessions.

It is a near-real-time monitor, refreshed about every 60 seconds. It is not tick-by-tick trading data, and I say so on the dashboard.

## Architecture

CoinPulse has three services on one Docker network: a Flask app, a PostgreSQL database, and an optional Adminer interface. The browser only talks to Flask on port 5000. Flask talks to PostgreSQL by the service name `db` and to the CoinGecko API over HTTPS. PostgreSQL is not published to my machine at all, so the only way in is through the app or Adminer.

All CoinGecko requests go through the backend. The API key lives in an environment variable on the server, so it never appears in the JavaScript that the browser downloads.

## The Dockerfile

I used a multi-stage build. The first stage installs the Python dependencies into a virtual environment. The second stage starts from a clean image and copies in only that virtual environment and the application code. Pip's cache and build leftovers stay behind in the first stage, so build tools never reach the final image. The container also runs as a non-root user. My final image size is 228 MB, measured with `docker images`. A single-stage build of this app was actually a little smaller (211 MB), because every dependency is a prebuilt wheel and nothing needs a compiler. The multi-stage pattern pays off when a package has to be compiled: in a test, building `psycopg2` from source gave 633 MB single-stage versus 222 MB multi-stage.

First, I copy `requirements.txt` and install dependencies before copying the source code. Docker caches layers, so changing a Python file no longer reinstalls every package. Second, I used `COPY` rather than `ADD`, because `ADD` also extracts archives and downloads URLs, which I did not need. A `.dockerignore` file keeps `.env`, git history, and cache folders out of the build context.

## The Docker Compose setup

Compose ties the services together. Three features did most of the work:

- **User-defined network and service-name DNS.** Containers on the `coinpulse-net` network find each other by name, so the app connects to `db` instead of an IP address that could change.
- **Healthchecks with `depends_on`.** The database runs `pg_isready`, and the app waits for `condition: service_healthy`. This is different from just waiting for the container to start, because PostgreSQL needs a few seconds before it accepts connections.
- **Profiles.** Adminer sits in a `tools` profile, so it only starts when I run `docker compose --profile tools up -d`.

## Live market data

The backend calls CoinGecko's `/coins/markets` endpoint, sorted by market cap, so the top five update automatically instead of being hardcoded. A second call to `/global` supplies the market summary, such as total market cap and Bitcoin dominance.

Responses are cached in memory for 60 seconds, which keeps me well within the free Demo plan's limits. If CoinGecko fails, the app returns the last good data marked as stale, and the dashboard shows when that data was last updated. After a failure, the backend waits 15 seconds before trying again, so a slow or rate-limited API does not make every refresh hang.

## Database persistence

The watchlist is stored in PostgreSQL, which keeps its files in a named volume. Running `docker compose down` and then `docker compose up -d` brings back the same watchlist, because the volume outlives the containers. Running `docker compose down -v` deletes the volume and the data with it, so it is the command to be careful with.

The app creates its table at startup with `CREATE TABLE IF NOT EXISTS` and retries the connection while the database boots. I chose this over an `init.sql` script because initialization scripts only run when the data directory is empty.

## Lessons learned

1. **Healthchecks beat startup order.** A container that has started is not necessarily a service that is ready.
2. **Volumes keep their first password.** PostgreSQL stores credentials in the volume on first start, so changing `POSTGRES_PASSWORD` later does not take effect until the volume is reset.
3. **A cache must be shared.** An in-memory cache only helps if all requests reach the same process, so I run gunicorn with one worker and several threads.
4. **Plan for the external API failing.** Caching, a stale fallback, and clear error states made the dashboard much more dependable.

CoinPulse is small, but building it showed me how images, networks, volumes, and health checks fit together in a real multi-container application.

**Repository:** `<add GitHub URL>` · **Video demo:** `<add YouTube URL>`
