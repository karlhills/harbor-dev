# Harbor

Harbor is a local-first webhook catcher and request viewer you can run on your own machine. It starts a local HTTP server, stores captured requests on disk, and provides a calm UI to inspect, replay, and export them in your browser.

## Features
- Webhook catcher for any method on `/hooks/*`
- Request list + detail viewer with headers and body
- Copy as curl, replay, and forwarding helpers
- Sessions to group traffic
- Redaction for sensitive headers and JSON keys
- Hook management (create/edit/delete + per-hook forwarding)
- Auto-forward when a hook has a forward URL
- Signature helpers (GitHub verify, Stripe parsing)
- Exports to JSON downloads (no cloud)
- Dark, minimal UI built with Tailwind

## Quickstart

### Development
```sh
npm install
npm run dev
```
- UI: http://localhost:5173
- Server: http://localhost:5178

### Production
```sh
npm install
npm run build
npm start
```
- App: http://localhost:5178

## Webhook usage
Send a test request:
```sh
curl -X POST http://localhost:5178/hooks/test \
  -H "Content-Type: application/json" \
  -d '{"event":"ping","ok":true}'
```

Stripe-like example:
```sh
curl -X POST http://localhost:5178/hooks/stripe/events \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_123","type":"invoice.created"}'
```

Example response:
```json
{ "ok": true, "id": "req_..." }
```

## Replay and forwarding
- Set a default forward URL per hook in the Hooks view.
- Use the Replay button in a request to forward it to the target.
- Copy as curl to share or replay manually.

## Exports
The Export button downloads a JSON file of the selected request. The server also supports fixture exports to `apps/server/data/exports/<exportId>/` with a `manifest.json` and request files.

## Local-only storage
Requests are stored on disk at `apps/server/data/requests.json`. The file is created at runtime and capped at 1000 requests (oldest are dropped).
You can open the data folder from Settings.

## Security notes
- Harbor is local-only by default (no auth, no cloud).
- Enable redaction in Settings to avoid storing secrets.
- Forwarding replays the already-redacted data stored on disk.

## Roadmap
- Multi-request export bundles
- Saved filters and presets
- Payload diffing and compare view
- More signature verifiers
- File log tailing

## Contributing
1. Fork the repo
2. Create a feature branch
3. Submit a PR with a clear description

## Screenshots
- `docs/screenshots/requests.png`
- `docs/screenshots/detail.png`
