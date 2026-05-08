# runyo

A personal training PWA for runners. Connect your Google Sheets training plan and receive daily Telegram notifications with what's on the schedule.

**Live:** [app.runyo.app](https://app.runyo.app)

## Stack

- Vanilla JS, no framework, no build step
- Google OAuth 2.0 (PKCE) + Sheets API v4
- Service Worker (PWA, offline-capable)
- Telegram bot for daily notifications

## Repos

| Repo | Purpose |
|------|---------|
| `runyo-app` | Frontend PWA (this repo) |
| `runyo-bot` | Telegram notification bot |
| `runyo-auth` | Auth backend (Railway) |
| `runyo-waitlist` | Landing page (runyo.app) |
