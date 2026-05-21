# Rollback runbook — app.runyo.app

Dit runbook beschrijft hoe je binnen 5 minuten terug kunt naar de legacy PWA als de v4 web-bundle problemen geeft.

## Architectuur

| Omgeving | Hoe gehost |
|----------|-----------|
| `app.runyo.app` | GitHub Pages (`runyoapp/runyo-app`, branch `main`, map `/dist`) |
| Legacy PWA | Branch `legacy-pwa` in `runyoapp/runyo-app` |

---

## Rollback — GitHub Pages

### Stap 1 — Revert de Pages-deploy via de UI

1. Ga naar `https://github.com/runyoapp/runyo-app/deployments`
2. Klik op de actieve deployment van `github-pages`
3. Klik **Re-run** op de vorige succesvolle deployment (die van de legacy PWA)
4. Wacht ±2 minuten tot de deployment actief is

### Stap 2 — Verifieer

```bash
curl -I https://app.runyo.app
# Verwacht: 200 OK
```

Open `https://app.runyo.app` in de browser en controleer of de legacy PWA laadt.

---

## Rollback — via git (als Pages-UI niet werkt)

```bash
# Zorg dat je op de main branch zit
git checkout main

# Maak een revert commit naar de laatste legacy-pwa staat
git revert HEAD --no-edit   # of cherry-pick een specifieke commit

# Push — Pages deploy start automatisch
git push origin main
```

Verwachte deploy-tijd: 1–3 minuten.

---

## Rollback ongedaan maken (terug naar v4)

```bash
git checkout main
git revert HEAD --no-edit   # revert de revert
git push origin main
```

---

## DNS (`app.runyo.app`)

DNS is een CNAME naar `runyoapp.github.io`. Dit hoef je bij een rollback niet te wijzigen — de Pages-branch bepaalt de content, niet de DNS.

---

## Signalen dat rollback nodig is

- Login werkt niet (OAuth callback faalt)
- Activiteiten laden niet (backend-connectie verbroken)
- App crasht bij opstarten (witte pagina of JS-fout in console)
- Performance onacceptabel op iOS Safari of Android Chrome

## Na het dogfooden — checklist voor definitieve go-live

- [ ] 1–2 weken dagelijks gebruikt zonder problemen
- [ ] Rollback getest in staging (noteer wall-clock-tijd hieronder)
  - Rollback-tijd: ___
  - Rollback-ongedaan-tijd: ___
- [x] `app.json` version `4.0.0` ✅
- [x] DNS `app.runyo.app` → GitHub Pages (CNAME) actief ✅ (live, HTTP 200)
- [x] HTTPS cert geldig (geen mixed-content warnings) ✅ (HSTS actief)
- [x] `legacy-pwa` branch bestaat in origin ✅
- [x] CLAUDE.md frontend-sectie geüpdatet ✅
