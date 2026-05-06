# Runyo — Migratieplan persoonlijk → runyo.app

Migratie van RunningX42 (persoonlijk) naar luuk@runyo.app account.

---

## Naamgeving (overal consistent)

| Wat | Oud | Nieuw |
|---|---|---|
| GitHub org | `RunningX42` (persoonlijk) | org: `runyo-app` |
| Repo frontend | `XApp` | `runyo-app` |
| Repo bot | `XBot` | `runyo-bot` |
| Repo backend | `runningx-auth` | `runyo-auth` |
| GitHub Pages URL | `runningx42.github.io/XApp/` | `runyo.app` |
| Railway project | persoonlijk account | project: `runyo` |
| Railway service bot | `XBot` | `runyo-bot` |
| Railway service backend | `runningx-auth` | `runyo-auth` |
| Google Cloud project | persoonlijk project | `runyo-app` |
| Google service account | persoonlijk | `bot@runyo-app.iam.gserviceaccount.com` |
| Drive settings bestand | `runningx-settings.json` | `runyo-settings.json` |

---

## Fase 1 — Accounts aanmaken
*(doe dit als eerste, niks kapot)*

- [ ] GitHub org aanmaken: `runyo-app` onder luuk@runyo.app
- [ ] Railway account aanmaken onder luuk@runyo.app
- [ ] Google Cloud project aanmaken: `runyo-app` (luuk@runyo.app)
- [ ] Formspree account aanmaken onder luuk@runyo.app

---

## Fase 2 — Google Cloud configureren

- [ ] OAuth 2.0 client aanmaken in `runyo-app` project
  - Type: Web application
  - Authorized redirect URI: `https://runyo.app/oauth-callback.html`
  - Noteer nieuwe `client_id` en `client_secret`
- [ ] OAuth scopes: `openid`, `email`, `profile`, `drive.file`, `drive.appdata`, `spreadsheets`
- [ ] Service account aanmaken voor de bot (naam: `bot`), JSON key downloaden
- [ ] OAuth verificatie aanvragen (privacy policy vereist — zie fase 5)

---

## Fase 3 — GitHub repos migreren

- [ ] Repos clonen vanuit RunningX42:
  ```bash
  git clone git@github.com:RunningX42/XApp.git runyo-app
  git clone git@github.com:RunningX42/XBot.git runyo-bot
  git clone git@github.com:RunningX42/runningx-auth.git runyo-auth
  ```
- [ ] Nieuwe repos aanmaken in org `runyo-app`: `runyo-app`, `runyo-bot`, `runyo-auth`
- [ ] Remotes overzetten en pushen naar nieuwe org
- [ ] GitHub Pages inschakelen op `runyo-app` repo (branch: `main`)
- [ ] Custom domain instellen: `runyo.app` in GitHub Pages settings
- [ ] DNS instellen bij domeinregistrar:
  - `A` records → `185.199.108.153` / `.109.153` / `.110.153` / `.111.153`
  - `CNAME www` → `runyo-app.github.io`

---

## Fase 4 — Code updaten
*(doe dit ná fase 2 en 3 zodat je de nieuwe waarden hebt)*

- [ ] `auth.js`: `client_id` → nieuwe OAuth client ID
- [ ] `auth.js`: `runningx-settings.json` → `runyo-settings.json`
- [ ] `runyo-auth/server.js`: CORS origins → `https://runyo.app`
- [ ] `index.html`: controleer op hardcoded `runningx42.github.io` verwijzingen

---

## Fase 5 — Privacy policy pagina
*(vereist voor Google OAuth verificatie)*

- [ ] Pagina aanmaken op `runyo.app/privacy`
- [ ] Inhoud: welke data, doel, hoe verwijderen
- [ ] Link toevoegen in de app footer

---

## Fase 6 — Railway deployen

- [ ] Nieuw Railway project `runyo` aanmaken
- [ ] Service `runyo-auth` aanmaken, koppelen aan `runyo-app/runyo-auth` repo
  ```
  GOOGLE_CLIENT_ID=<nieuwe client id>
  GOOGLE_CLIENT_SECRET=<nieuwe client secret>
  ANTHROPIC_API_KEY=<huidig of nieuw>
  BOT_SECRET=<genereer nieuw gedeeld secret>
  ```
- [ ] Service `runyo-bot` aanmaken, koppelen aan `runyo-app/runyo-bot` repo
  ```
  BOT_SECRET=<zelfde als auth>
  BACKEND_URL=https://<nieuwe runyo-auth Railway URL>
  FALLBACK_CHAT_ID=9452843
  GOOGLE_CREDENTIALS=<nieuwe service account JSON>
  ```
- [ ] Optioneel: custom domain `api.runyo.app` voor auth backend

---

## Fase 7 — Telegram bot

- [ ] Nieuw bot token via @BotFather (of bestaande overdragen)
  - `/mybots` → RunyoBot → `API Token` → `Revoke` → nieuw token
- [ ] Nieuw token instellen als Railway env var `BOT_TOKEN`
- [ ] Bot naam/username blijft: `@RunyoBot`

---

## Fase 8 — Overige services

- [ ] Formspree: nieuw formulier aanmaken, ID updaten in `runyo-waitlist/index.html`
- [ ] Anthropic API: blijft voorlopig op persoonlijk account, migreer zodra tegoed op is

---

## Fase 9 — Testen & cutover

- [ ] App testen op `runyo.app` — login, schema koppelen, import, Telegram
- [ ] Bot testen — `/start`, dagelijks bericht, feedback
- [ ] Backend health: `https://api.runyo.app/health`
- [ ] Oude RunningX42 setup minimaal 1 week als fallback laten staan

---

## Fase 10 — Opruimen

- [ ] `RunningX42` GitHub repos archiveren (niet verwijderen)
- [ ] Oude Railway services stoppen
- [ ] Oude Google Cloud OAuth client intrekken
- [ ] `CLAUDE.md` updaten met nieuwe URLs en account

---

**Aanbevolen volgorde op één dag:** Fase 1 → 2 → 3 → 4 → 6 → 7 → 9
Fase 5 en 8 kunnen parallel of daarna.
