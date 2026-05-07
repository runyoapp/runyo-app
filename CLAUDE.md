# runyo — CLAUDE.md

## Naamgeving — KRITIEK

**De productnaam is altijd `runyo` — volledig lowercase, geen uitzonderingen.**
- Nooit: `Runyo`, `RunYo`, `RUNYO`
- Altijd: `runyo`
- Geldt voor: code, comments, UI-tekst, logs, commit messages, documentatie

## Socials

| Platform | Handle |
|----------|--------|
| Instagram | @runyo_app |
| TikTok | @runyo_app |
| X (Twitter) | @runyo_app |

## Product

runyo is een persoonlijke trainingsapp voor hardlopers. Gebruikers koppelen hun Google Sheets trainingsplan en ontvangen dagelijkse notificaties via Telegram. De app is een PWA (Progressive Web App).

Huidige versie: **v3.50.0**

---

## Repositories

Alle repos staan onder GitHub org **runyoapp** (info@runyo.app).

| Repo | Doel | Hosting |
|------|------|---------|
| `runyoapp/runyo-app` | Frontend PWA | GitHub Pages → `app.runyo.app` (DNS pending) |
| `runyoapp/runyo-bot` | Telegram notificatie bot | Railway (Docker), info@runyo.app account |
| `runyoapp/runyo-auth` | Auth backend + settings API | Railway (Node.js), info@runyo.app account |
| `runyoapp/runyo-waitlist` | Waitlist landingspagina | Cloudflare Worker → `runyo.app` |
| `runyoapp/claude` | Claude Code agents + config | — |

---

## XApp / runyo-app (frontend)

**Stack:** Vanilla JS, geen framework, geen build stap. Drie bestanden draaien alles:
- `app.js` — alle app-logica (~3600 regels)
- `auth.js` — Google OAuth PKCE flow, Sheets API, Drive appData sync
- `style.css` — design system (Mint Stride), mobile-first + desktop sidebar layout

**Auth:** Google OAuth 2.0 PKCE. Access token in localStorage, refresh via `/auth/refresh` op de backend.

**Data:** Trainingsplan leeft in Google Sheets, geladen via Apps Script Web App URL of direct via Sheets API v4.

**Instellingen sync:** `accountSnap_[email]` in localStorage + gespiegeld naar Google Drive appDataFolder (`runyo-settings.json`). Bij wijziging notificatie-instellingen wordt ook gepusht naar `/user/settings` op de auth backend.

**Google OAuth client-id:** `360342745908-n5l0071jgfb76nn0qtj65d9rcmolgbqf.apps.googleusercontent.com`
- Project: `runyo-app` (Google Cloud, info@runyo.app)
- Authorized redirect URI: `https://app.runyo.app/oauth-callback.html`
- App staat in **testmodus** — OAuth verificatie aanvragen zodra privacy policy live is

**Design system (Mint Stride):**
- Font: Sora (display) + JetBrains Mono (mono)
- Achtergrond: `#F1EEE6` (warm paper, light mode default)
- Accent: `#00B98E` (mint)
- Donker: `#0E1F1A`

---

## runyo-bot (Telegram bot)

**Stack:** Python 3.11, `python-telegram-bot[job-queue,webhooks]`, `gspread`, `httpx`

**Bot:** `@runyo_appbot`

**Scheduling:** Dynamisch — laadt per-gebruiker instellingen via `GET /user/settings` op de backend bij opstarten en elk uur.

**Koppeling:** Bij `/start` registreert de bot het chatId via `POST /bot/register`. De app pusht telegramUser + notif-instellingen naar de backend.

**Env vars op Railway (info@runyo.app account):**
```
BOT_TOKEN=<token van @runyo_appbot via BotFather — lees uit env var>
BOT_SECRET=<gedeeld secret met auth backend>
BACKEND_URL=https://runyo-auth-production.up.railway.app
FALLBACK_CHAT_ID=9452843
GOOGLE_CREDENTIALS=<service account JSON — runyo-bot@runyo-app.iam.gserviceaccount.com>
PYTHONUNBUFFERED=1
```

**Belangrijk:** TOKEN altijd uit `BOT_TOKEN` env var lezen, nooit hardcoden.

---

## runyo-auth (backend)

**Stack:** Node.js, Express

**URL:** `https://runyo-auth-production.up.railway.app`

**Endpoints:**
| Method | Path | Auth | Doel |
|--------|------|------|------|
| POST | `/auth/token` | — | OAuth code → access token exchange |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/ai/import` | — | Proxy naar Anthropic API |
| GET/POST | `/ai/debug-log` | — | Import log voor intern gebruik |
| POST | `/user/settings` | Google token | App slaat notif-instellingen op |
| GET | `/user/settings` | BOT_SECRET | Bot haalt alle user settings op |
| POST | `/bot/register` | BOT_SECRET | Bot registreert chatId voor username |
| GET | `/health` | — | Health check |

**Env vars op Railway:**
```
GOOGLE_CLIENT_ID=360342745908-n5l0071jgfb76nn0qtj65d9rcmolgbqf.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<uit Google Cloud Console>
ANTHROPIC_API_KEY=<runyo account of persoonlijk zolang tegoed duurt>
BOT_SECRET=<zelfde als bij runyo-bot>
```

---

## Werkwijze

- **Commit na elke aanpassing** — geen uitzondering
- Geen build stap — wijzigingen in runyo-app zijn direct live na push (GitHub Pages)
- runyo-bot en runyo-auth deployen automatisch via Railway bij push naar `main`
- Versienummer in `index.html` bijhouden bij releases

## Claude config

- Agents en settings leven in `runyoapp/claude` — dit is de bron van waarheid
- Bij wijzigingen aan agents: ook pushen naar die repo
- Setup nieuw device: `git clone git@github.com:runyoapp/claude.git` → agents kopiëren naar `~/.claude/agents/`

---

## Open acties (migratie vrijwel klaar)

- [ ] DNS verificatie GitHub Pages afwachten → `app.runyo.app` instellen + Enforce HTTPS
- [ ] Google OAuth verificatie aanvragen (vereist privacy policy — al live op `runyo.app/privacy`)
- [ ] Railway Volume toevoegen voor persistente settings opslag (nu gaat `/tmp/runyo-settings.json` verloren bij restart)
- [ ] PAT `github_pat_11CDJFI6Q…` revoken zodra migratie volledig klaar is

## Architectuur

- `runyo.app` (apex + www) → Cloudflare Worker (`runyoapp/runyo-waitlist`)
- `app.runyo.app` → GitHub Pages (`runyoapp/runyo-app`) — DNS pending
- `runyo-auth-production.up.railway.app` → Railway backend
