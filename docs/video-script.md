# CoinPulse – YouTube Demonstration Script (3–5 minutes)

**Winsen Cristiano Sun · Cloud Services project**

Total narration is about 455 words, roughly 3.5 minutes of speech at a calm pace. With typing commands and waiting for output, the video should land around 4 to 4.5 minutes, inside the 3 to 5 minute target. Read it once aloud with a timer and adjust. Replace anything in `<angle brackets>` with what you actually see on your screen.

## Before recording

- [ ] `.env` filled in with your CoinGecko Demo key
- [ ] Containers stopped (`docker compose down`) so you can show a clean start
- [ ] Watchlist empty (or you know what it contains)
- [ ] Terminal font large; browser zoom around 110%
- [ ] Windows open: browser (`localhost:5000`), terminal in the project folder, editor with `Dockerfile` and `docker-compose.yml`
- [ ] Hide your real API key and password on screen (blur the `.env` file or don't open it)

## Script

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:25 | Title slide or the dashboard | "Hi, I'm Winsen, and this is CoinPulse, a crypto market dashboard I built for my Docker and containerization assignment. It shows the top five cryptocurrencies by market cap in rupiah, with a watchlist saved in PostgreSQL. Everything runs in containers with Docker Compose." |
| 0:25–1:05 | Dashboard in the browser | "Here is the running dashboard. The top five coins come live from the CoinGecko API, with price, 24-hour change in green or red, market cap, and volume. The header shows when the data was last updated. This is near-real-time monitoring, refreshed about every 60 seconds, not tick-by-tick trading. Now I'll add Bitcoin and Ethereum to the watchlist with the star icon. They appear in the watchlist panel." |
| 1:05–1:55 | `Dockerfile` in the editor | "Now the Dockerfile. It's a multi-stage build. The builder stage installs dependencies into a virtual environment. The runtime stage copies only that environment and the app code, so build leftovers don't end up in the final image. Both stages use a pinned Python version, and the container runs as a non-root user. Notice that requirements.txt is copied before the source code, so Docker can cache the dependency layer. I use COPY instead of ADD because ADD can also extract archives and download URLs, which I don't need." |
| 1:55–2:45 | `docker-compose.yml` in the editor | "Docker Compose defines three services: the Flask app, PostgreSQL, and an optional Adminer. They share a user-defined network, so the app reaches the database by the name db instead of an IP address. The database has a healthcheck, and the app uses depends_on with service_healthy, so it only starts once PostgreSQL is ready. Data is stored in a named volume. Secrets come from an env file that is not committed to Git. Adminer sits behind the tools profile, so it only starts when I ask for it." |
| 2:45–3:05 | Terminal: `docker compose up -d --build`, then `docker compose ps` | "Let me start it from scratch. I run docker compose up with build, then docker compose ps. Both the app and the database show as healthy." |
| 3:05–3:40 | Terminal: curl commands | "Now the API. The health endpoint returns 200 and says the database is up. The market endpoint returns the top five coins as JSON. I'll add a coin with a POST request. It returns 201. If I send the same request again, I get 409 because duplicates are blocked. And an invalid request returns 400." |
| 3:40–4:25 | Terminal: `docker compose down`, `docker compose up -d`, curl the watchlist; refresh the browser | "Finally, persistence. I run docker compose down, which removes the containers, then bring everything back up. When I request the watchlist, the same entries are still there, and so they are in the browser after a refresh. That's the named volume at work. Be careful with docker compose down with the dash v flag, because that also deletes the volume and the data." |
| 4:25–4:45 | Dashboard or title slide | "That's CoinPulse: a Flask app, PostgreSQL, and live market data, running together with Docker Compose. The code and README are linked in the description. Thanks for watching." |

## Commands to type on camera

```bash
docker compose up -d --build
docker compose ps
curl -i http://localhost:5000/health
curl -s http://localhost:5000/api/market
curl -i -X POST http://localhost:5000/api/watchlist -H "Content-Type: application/json" -d '{"coin_id":"bitcoin"}'
curl -i -X POST http://localhost:5000/api/watchlist -H "Content-Type: application/json" -d '{"coin_id":"bitcoin"}'
curl -s http://localhost:5000/api/watchlist
docker compose down
docker compose up -d
curl -s http://localhost:5000/api/watchlist
```

On Windows PowerShell, use `curl.exe` and escape the JSON quotes (`"{\"coin_id\":\"bitcoin\"}"`).

## Demonstration checklist

- [ ] Project introduction (what and why)
- [ ] Dashboard: live data, colors, last-updated time
- [ ] Watchlist: add and remove coins
- [ ] Dockerfile: multi-stage, caching, COPY vs ADD, non-root user
- [ ] Docker Compose: services, network, healthchecks, volume, profile
- [ ] `docker compose ps` showing healthy containers
- [ ] API tests: 200, 201, 409, 400
- [ ] Persistence: `down` then `up`, data still present
- [ ] Mention that `down -v` deletes the data

## After recording

- [ ] Add the video link to `README.md` and `docs/article.md`
- [ ] Put the repository link in the video description
- [ ] Don't mention the video as published anywhere until it actually is
