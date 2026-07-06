# rezeis-subpage

Subscription page for the **Rezeis** stack — a fork of
[remnawave/subscription-page](https://github.com/remnawave/subscription-page).

Unlike upstream (which stores its config in the Remnawave panel), this fork sources all
**branding, app catalog, translations, icons and theme from rezeis-admin**, while subscription
**data still comes directly from Remnawave**. The look is configured live from the rezeis-admin panel
(no redeploy).

## How it works

```
[Browser]    → rezeis-subpage ── config ─▶ rezeis-admin   (branding / apps / theme / translations)
                     │
                     └────────── sub data ─▶ Remnawave     (getSubscriptionInfo / api/sub/…)
[VPN client] → rezeis-subpage ── proxy ────▶ Remnawave     (api/sub/{shortUuid}[/{client}])
rezeis-admin ── invalidate webhook ────────▶ rezeis-subpage (instant config refresh)
```

- **frontend** — React 19 + Mantine 9 + Vite (Feature-Sliced Design), liquid-glass theme.
- **backend** — NestJS 11 + Express: serves the SPA, proxies subscription data from Remnawave,
  fetches the effective config from rezeis-admin (cached + TTL + invalidate webhook).

## Configuration

See [`backend/.env.sample`](backend/.env.sample). Minimum:
`REMNAWAVE_PANEL_URL`, `REMNAWAVE_API_TOKEN`, `INTERNAL_JWT_SECRET`, `REZEIS_ADMIN_URL`,
`REZEIS_ADMIN_TOKEN` (+ optional `REZEIS_SUBPAGE_WEBHOOK_SECRET`).

## Docs

- [`docs/REZEIS-RESEARCH.md`](docs/REZEIS-RESEARCH.md) — architecture, Remnawave coupling, upstream analysis.
- [`docs/REZEIS-FORK.md`](docs/REZEIS-FORK.md) — fork plan, integration (tokens, same/split VPS), build & deploy.
- [`docs/examples/catalog.reference.example.json`](docs/examples/catalog.reference.example.json) — full client catalog example.

## Run

```bash
docker compose up -d --build   # own container; reverse-proxy the subdomain to rezeis-subpage:3010
```

## License

**AGPL-3.0** (inherited from upstream). See [`LICENCE`](LICENCE). This is a modified network-served
version; its source is published here per AGPL. Upstream: remnawave/subscription-page.
