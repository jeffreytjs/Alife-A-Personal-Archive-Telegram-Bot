# Architecture Decision Records (ADR)

This folder records significant technical and product decisions for **Alife - A Personal Archive** — a Telegram bot that sends one daily word prompt (8:00 Asia/Singapore) so people capture one photo or video per day and build a personal archive over time.

## Index

| ADR | Title | Status |
|-----|--------|--------|
| [0001](./0001-daily-prompt-telegram-bot.md) | Daily prompt Telegram bot (MVP scope, hosting, scheduling) | Accepted |
| [0002](./0002-prompt-configuration-format.md) | Prompt configuration (day / week / month, overrides) | Accepted |
| [0003](./0003-state-without-database.md) | Subscriber and quota state without a database | Accepted |

## How to use ADRs

1. Read ADRs before implementing features that touch scheduling, prompts, or persistence.
2. When changing an accepted decision, add a new ADR that **supersedes** the old one (do not silently edit history except typos).
3. Link ADRs from tickets in [`../TICKETS.md`](../TICKETS.md).

## Status meanings

- **Proposed** — under discussion
- **Accepted** — implement against this decision
- **Deprecated** — do not use for new work
- **Superseded** — replaced by a newer ADR
