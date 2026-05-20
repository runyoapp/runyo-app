# Kanban — runyo v4

Markdown-tickets voor de runyo v4-migratie van PWA naar React Native. Elke ticket beschrijft één vertical slice met acceptance criteria, test-strategie en (voor AFK-werk) tech-hints. Agents lezen en updaten deze files tijdens werk; de user reviewt PR's.

Zie ook: [`project-workflow.md`](../../../claude/project-workflow.md) (werkmethodiek), [`prd-runyo-v4.md`](../../../claude/prd-runyo-v4.md) (PRD), [`vertical-slices-runyo-v4.md`](../../../claude/vertical-slices-runyo-v4.md) (bron-slices).

## DAG-overzicht

```
Fase 1 (sequentieel)
  1.1 (test-infra)  ->  1.2 (backend baseline)  ->  1.3 (deep-module refactor — parallel met 1.2)
                                |
Fase 2 (DAG)                    v
                       2.1 (activity CRUD)
                       /        |        \
              2.2 (import) -> 2.4 (edits) -> 2.6 (bot)
                                |
                       (parallel: 2.3 auth, 2.5 push)
                                |
Fase 3 (sequentieel + parallel binnen fase)
                                v
                       3.1 (web cutover) || 3.2 (native builds)
                                          ||
                              3.3 (Sheets sync, optioneel)
                                          |
                                          v
                              3.4 (manuele QA-pass)
```

## Tickets

| Fase | ID | Titel | Type | Status |
|------|----|-------|------|--------|
| 1 | 1.1 | Test- en feedback-infra | AFK | completed |
| 1 | 1.2 | Backend baseline + eerste schema-tracer | AFK | completed |
| 1 | 1.3 | Deep-module refactor | AFK | pending |
| 2 | 2.1 | Activity CRUD end-to-end | AFK | completed |
| 2 | 2.2 | Importer schrijft naar backend | AFK | pending |
| 2 | 2.3 | Auth-breedte (Apple + email) | AFK (subset HITL) | pending |
| 2 | 2.4 | Edits-flow (drag + delete + rust + feedback) | AFK | pending |
| 2 | 2.5 | Native push notifications | AFK (subset HITL) | pending |
| 2 | 2.6 | Telegram-bot reads from backend | AFK | pending |
| 3 | 3.1 | Web build + directe cutover | HITL | pending |
| 3 | 3.2 | Native builds + store submission | HITL | pending |
| 3 | 3.3 | Sheets sync (optioneel) | AFK (optioneel) | pending |
| 3 | 3.4 | Manuele QA-pass | HITL | pending |

## Hoe een ticket te claimen

1. Lees de ticket-file. Check `Depends on` — als die niet `completed` zijn, kies een andere.
2. Update de frontmatter: voeg `Status: in_progress` toe (of bewerk indien al aanwezig).
3. Commit de status-wijziging apart: `git commit -m "ticket: <id> start"`.
4. Werk de slice af. Bij afronding: zet `Status: completed`, voeg de PR-link toe als `PR: <url>`, en commit als `ticket: <id> complete`.
5. Voor bugs uit 3.4: maak nieuwe files met id-conventie `qa-NNN-<short>.md`.
