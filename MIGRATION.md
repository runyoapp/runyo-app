# runyo — Migratieplan persoonlijk → runyo.app

Migratie van RunningX42 (persoonlijk) naar info@runyo.app account.

---

## Naamgeving (overal consistent)

| Wat | Oud | Nieuw |
|---|---|---|
| GitHub org | `RunningX42` (persoonlijk) | org: `runyoapp` |
| Repo frontend | `XApp` | `runyo-app` |
| Repo bot | `XBot` | `runyo-bot` |
| Repo backend | `runningx-auth` | `runyo-auth` |
| GitHub Pages URL | `runningx42.github.io/XApp/` | `runyo.app` |
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

- [ ] Repos clonen vanuit RunningX42:
  ```bash
  git clone git@github.com:RunningX42/XApp.git runyo-app
  git clone git@github.com:RunningX42/XBot.git runyo-bot
  git clone git@github.com:RunningX42/runningx-auth.git runyo-auth
  ```
- [ ] Nieuwe repos aanmaken in org `runyoapp`: `runyo-app`, `runyo-bot`, `runyo-auth`
- [ ] Remotes overzetten en pushen naar nieuwe org
- [ ] GitHub Pages inschakelen op `runyo-app` repo (branch: `main`)
- [ ] Custom domain instellen: `runyo.app` in GitHub Pages settings
- [ ] DNS instellen bij domeinregistrar:
  - `A` records → `185.199.108.153` / `.109.153` / `.110.153` / `.111.153`
  - `CNAME www` → `runyoapp.github.io`

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
- [ ] Service `runyo-auth` aanmaken, koppelen aan `runyoapp/runyo-auth` repo
  ```
  GOOGLE_CLIENT_ID=<nieuwe client id>
  GOOGLE_CLIENT_SECRET=<nieuwe client secret>
  ANTHROPIC_API_KEY=<huidig of nieuw>
  BOT_SECRET=<genereer nieuw gedeeld secret>
  ```
- [ ] Service `runyo-bot` aanmaken, koppelen aan `runyoapp/runyo-bot` repo
  ```
  BOT_SECRET=<zelfde als auth>
  BACKEND_URL=https://<nieuwe runyo-auth Railway URL>
  FALLBACK_CHAT_ID=9452843
  GOOGLE_CREDENTIALS=<nieuwe service account JSON>
  ```
- [ ] Optioneel: custom domain `api.runyo.app` voor auth backend

---

## Fase 7 — Telegram bot

- [ ] Nieuwe bot aanmaken via @BotFather (alle lowercase, geen bestaande bot overzetten)
  - In Telegram: open @BotFather → `/newbot`
  - Bot name: `runyo`
  - Bot username: `runyobot` (moet eindigen op `bot`, lowercase)
  - Token noteren
- [ ] Token instellen als Railway env var `BOT_TOKEN` voor service `runyo-bot`
- [ ] Bot username vastgelegd: `@runyobot`

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

## Fase 0 — Claude config repo (nu al doen)

- [ ] Repo `RunningX42/claude` aanmaken op GitHub (leeg)
- [ ] Pushen: `cd ~/projects/claude-repo && git remote add origin git@github.com:RunningX42/claude.git && git push -u origin master`
- [ ] Op elk nieuw device: `git clone git@github.com:RunningX42/claude.git` en agents kopiëren naar `~/.claude/agents/`
- [ ] Na migratie: repo hernoemen naar `runyoapp/claude`

---

## Fase 10 — Opruimen

- [ ] `RunningX42` GitHub repos archiveren (niet verwijderen)
- [ ] Oude Railway services stoppen
- [ ] Oude Google Cloud OAuth client intrekken
- [ ] `CLAUDE.md` updaten met nieuwe URLs en account

---

**Aanbevolen volgorde op één dag:** Fase 1 → 2 → 3 → 4 → 6 → 7 → 9
Fase 5 en 8 kunnen parallel of daarna.
