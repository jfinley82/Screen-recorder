# Screen-recorder (ScreenClips)

This is the **ScreenClips** web application — the full product at screenclips.co.

## Structure
- `server/` — Express + tRPC backend, deployed to Railway
- `client/` — React + Vite frontend
- `extension/` — Chrome extension (pushed to Screen-recorder repo, loaded unpacked on Mac)
- `drizzle/` — MySQL schema and migrations

## Deployment
- **Host**: Railway (watches this repo's `main` branch via Dockerfile)
- **Domain**: screenclips.co (Cloudflare → Railway)
- **DB**: MySQL on Railway

## NOT this repo
`community-app` is a separate unrelated project. All ScreenClips work goes here.
