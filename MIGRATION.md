# runyo — Migratieplan persoonlijk → runyo.app

Migratie van RunningX42 (persoonlijk) naar info@runyo.app account.

---

## 📍 Resume — laatste stand (2026-05-06)

**Klaar:** Fase 0, 1, 2 (m.u.v. OAuth verificatie), 3 (m.u.v. Pages SSL cert), 4 (m.u.v. import-log.html URL), 6 ✅, 7 ✅

**Volgende keer beginnen bij: DNS verificatie GitHub Pages + Fase 9 testen.**

**Open acties:**
- [ ] DNS TXT verificatie GitHub Pages afwachten (`_github-pages-challenge-runyoapp` toegevoegd aan Cloudflare)
- [ ] Na verificatie: custom domain `app.runyo.app` instellen in GitHub Pages + Enforce HTTPS aanvinken
- [ ] `import-log.html` URL bijwerken naar Railway URL van `runyo-auth`
- [ ] Fase 9: app testen op `app.runyo.app` (login, schema, bot)
- [ ] Fase 5: privacy policy op `app.runyo.app/privacy.html`
- [ ] OAuth verificatie aanvragen — kan pas na privacy policy live
- [ ] PAT `github_pat_11CDJFI6Q…` revoken op github.com/settings/tokens zodra migratie klaar

**Architectuur recap:**
- `runyo.app` (apex + www) → Cloudflare Worker `runyo-waitlist` (al live, ongewijzigd)
- `app.runyo.app` → GitHub Pages voor `runyoapp/runyo-app`
- `api.runyo.app` (optioneel later) → Railway service `runyo-auth`
- Telegram: `@runyo_appbot` (nog aan te maken in Fase 7)

**Lokale checkouts (Windows machine):**
- `C:\Users\Luuk\projects\XApp` — origin = `runyoapp/runyo-app`, fallback `runningx42`
- `C:\Users\Luuk\projects\XBot` — origin = `runyoapp/runyo-bot`, fallback `runningx42`
- `C:\Users\Luuk\projects\runningx-auth` — origin = `runyoapp/runyo-auth`, fallback `runningx42`
- `C:\Users\Luuk\projects\claude` — origin = `runyoapp/claude` (master), fallback `runningx42`
- `C:\Users\Luuk\projects\runyo-waitlist` — origin = `runyoapp/runyo-waitlist`

---

## Naamgeving (overal consistent)

| Wat | Oud | Nieuw |
|---|---|---|
| GitHub org | `RunningX42` (persoonlijk) | org: `runyoapp` |
| Repo frontend | `XApp` | `runyo-app` |
| Repo bot | `XBot` | `runyo-bot` |
| Repo backend | `runningx-auth` | `runyo-auth` |
| Repo waitlist (landing) | (alleen lokaal) | `runyo-waitlist` (public, custom domain `runyo.app`) |
| Live hosting | `runningx42.github.io/XApp/` (GitHub Pages) | `runyo.app` via Cloudflare Worker `runyo-waitlist` (apex + www) + `app.runyo.app` via GitHub Pages (app) |
| Railway project | persoonlijk account | project: `runyo` |
| Railway service bot | `XBot` | `runyo-bot` |
| Railway service backend | `runningx-auth` | `runyo-auth` |
| Google Cloud project | persoonlijk project | `runyo-app` |
| Google service account | persoonlijk | `runyo-bot@runyo-app.iam.gserviceaccount.com` |
| Drive settings bestand | `runningx-settings.json` | `runyo-settings.json` |
| Claude config repo | `RunningX42/claude` | `runyoapp/claude` |

---

## Fase 1 — Accounts aanmaken
*(doe dit als eerste, niks kapot)*

- [x] GitHub org aanmaken: `runyoapp` onder info@runyo.app
- [x] Railway account aanmaken onder info@runyo.app
- [x] Google Cloud project aanmaken: `runyo-app` (info@runyo.app)
- [x] Formspree account aanmaken onder info@runyo.app

---

## Fase 2 — Google Cloud configureren

- [x] OAuth 2.0 client aanmaken in `runyo-app` project
  - Type: Web application
  - Authorized redirect URI: `https://runyo.app/oauth-callback.html`
  - Noteer nieuwe `client_id` en `client_secret`
- [x] OAuth scopes: `openid`, `email`, `profile`, `drive.file`, `drive.appdata`, `spreadsheets`
- [x] Service account aanmaken voor de bot (naam: `runyo-bot`), JSON key downloaden
  - Org policy `iam.disableServiceAccountKeyCreation` moest eerst uit (gcloud `disable-enforce` op project `runyo-app`)
- [ ] OAuth verificatie aanvragen (privacy policy vereist — zie fase 5)

---

## Fase 3 — GitHub repos migreren

Architectuur: `runyo.app` (apex + www) wordt geserveerd door een bestaande Cloudflare Worker `runyo-waitlist` — niet via GitHub Pages. `app.runyo.app` subdomein = de app via GitHub Pages (repo `runyo-app`). De `runyoapp/runyo-waitlist` repo dient als source-of-truth voor wijzigingen aan de waitlist; live deploy gaat via de Worker.

- [x] Repos clonen vanuit RunningX42 (XApp, XBot, runningx-auth, claude)
- [x] Nieuwe repos aanmaken in org `runyoapp`: `runyo-app`, `runyo-bot`, `runyo-auth`, `runyo-waitlist`, `claude`
- [x] Remotes overzetten en pushen naar nieuwe org (HTTPS via fine-grained PAT; lokale checkouts hebben `origin` → `runyoapp/*` en `runningx42` → oude repo als fallback)
- [x] DNS bij Cloudflare voor `app.runyo.app`: `CNAME app → runyoapp.github.io` (proxy off / DNS only) — apex blijft via Worker
- [ ] GitHub Pages inschakelen op `runyo-app` repo (branch `main`) → custom domain `app.runyo.app`
  - Cert provisioning duurt ~30 min na DNS prop; daarna **Enforce HTTPS** aanvinken
- [ ] (later, niet kritiek) GitHub Actions deploy van `runyoapp/runyo-waitlist` naar de Cloudflare Worker, zodat repo en live in sync blijven

---

## Fase 4 — Code updaten
*(doe dit ná fase 2 en 3 zodat je de nieuwe waarden hebt)*

- [x] `auth.js`: `client_id` → nieuwe OAuth client ID (`360342745908-n5l0071j...`)
- [x] `auth.js`: redirect URI is dynamisch (`window.location.origin + '/oauth-callback.html'`) — werkt automatisch op `app.runyo.app`
- [x] `auth.js`: `runningx-settings.json` → `runyo-settings.json`
- [x] `runyo-auth/server.js`: CORS origins → `https://app.runyo.app`
- [x] `ai-proxy-endpoint.js`: ALLOWED_ORIGINS → `https://app.runyo.app` + `https://runyo.app`
- [x] `index.html`: geen hardcoded `runningx42.github.io` verwijzingen gevonden
- [ ] `auth.js`: `AUTH_BACKEND` → nieuwe Railway URL (na Fase 6)
- [ ] `import-log.html`: API URL → nieuwe Railway URL (na Fase 6)

---

## Fase 5 — Privacy policy pagina
*(vereist voor Google OAuth verificatie)*

- [ ] Pagina aanmaken op `runyo.app/privacy`
- [ ] Inhoud: welke data, doel, hoe verwijderen
- [ ] Link toevoegen in de app footer

---

## Fase 6 — Railway deployen

- [x] Nieuw Railway project `runyo` aanmaken
- [x] Service `runyo-auth` aanmaken, koppelen aan `runyoapp/runyo-auth` repo
  ```
  GOOGLE_CLIENT_ID=✅
  GOOGLE_CLIENT_SECRET=✅
  ANTHROPIC_API_KEY=✅ (nieuwe key aangemaakt)
  BOT_SECRET=✅
  ```
- [x] Service `runyo-bot` aanmaken, koppelen aan `runyoapp/runyo-bot` repo
  ```
  BOT_SECRET=✅
  BACKEND_URL=✅
  FALLBACK_CHAT_ID=✅
  GOOGLE_CREDENTIALS=⏳ placeholder — invullen bij desktop
  BOT_TOKEN=⏳ placeholder — invullen na fase 7
  ```
- [ ] Optioneel: custom domain `api.runyo.app` voor auth backend

---

## Fase 7 — Telegram bot

- [x] Bot aangemaakt: `@runyo_appbot`
- [x] Token ingesteld als Railway env var `BOT_TOKEN`
- [x] Bot reageert op `/start` ✅
- [x] bot.py leest TOKEN uit env var (niet hardcoded)
  - Let op: hardcoded token veroorzaakte 409 conflicts — altijd via BOT_TOKEN env var

---

## Fase 8 — Overige services

- [ ] Formspree: nieuw formulier aanmaken, ID updaten in `runyo-waitlist/index.html`
- [ ] Anthropic API: blijft voorlopig op persoonlijk account, migreer zodra tegoed op is

---

## Fase 9 — Testen & cutover

- [ ] App testen op `app.runyo.app` — login, schema koppelen, import, Telegram
- [ ] Landing testen op `runyo.app` — Formspree waitlist submit werkt
- [ ] Bot testen — `/start`, dagelijks bericht, feedback
- [ ] Backend health: `https://api.runyo.app/health`
- [ ] Oude RunningX42 setup minimaal 1 week als fallback laten staan

---

## Fase 0 — Claude config repo (klaar)

- [x] Repo `RunningX42/claude` aangemaakt + lokale agents/ + settings gepushed
- [x] Op deze Windows-machine: cloned + agents gekopieerd naar `~/.claude/agents/`
- [x] In Fase 3: tweede remote naar `runyoapp/claude` toegevoegd en gepushed (geen rename — RunningX42 blijft als fallback)

---

## Fase 10 — Opruimen

- [ ] `RunningX42` GitHub repos archiveren (niet verwijderen)
- [ ] Oude Railway services stoppen
- [ ] Oude Google Cloud OAuth client intrekken
- [ ] `CLAUDE.md` updaten met nieuwe URLs en account

---

**Aanbevolen volgorde op één dag:** Fase 1 → 2 → 3 → 4 → 6 → 7 → 9
Fase 5 en 8 kunnen parallel of daarna.
