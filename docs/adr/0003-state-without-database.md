# ADR 0003: Subscriber and quota state without a database

- **Status:** Accepted
- **Date:** 2026-09-14
- **Related:** [ADR 0001](./0001-daily-prompt-telegram-bot.md), [TICKETS.md](../TICKETS.md)

## Context

MVP excludes Postgres, Redis, and hosted DB. The template already uses an **in-memory** `db.ts` shim for conversation memory. The product needs:

- Set of **chat IDs** (users/chats) opted in via `/start`.
- Per user, per **SGT calendar date**:
  - Whether **daily prompt** was sent (optional marker to avoid duplicate scheduler sends).
  - Whether **`/another`** was consumed.
- Optional: last known username for logging.

Telegram chat IDs are stable; losing the set on restart is acceptable short-term but must be documented to users.

## Decision

Implement a dedicated module `src/services/subscriberStore.ts` (name illustrative) backed by **in-memory `Map` structures**, not YAML and not git-tracked user data.

### Data structures

```text
subscribers: Set<number>                    // chat_id
dailyState: Map<string, DailyRecord>        // key = `${chatId}:${YYYY-MM-DD}` (SGT)
  DailyRecord: {
    primarySentAt?: number
    alternateUsed: boolean
  }
```

Use **`Intl` / `Temporal` or `luxon`** (pick one in implementation) for SGT date boundaries, not UTC midnight.

### Operations

| Operation | Behavior |
|-----------|----------|
| `subscribe(chatId)` | Add to set; idempotent |
| `unsubscribe(chatId)` | Remove from set |
| `isSubscribed(chatId)` | Membership test |
| `markPrimarySent(chatId, date)` | Set `primarySentAt` |
| `canUseAlternate(chatId, date)` | `!alternateUsed` |
| `consumeAlternate(chatId, date)` | Set `alternateUsed = true` |

### Interaction with scheduler

- At 08:00 SGT, iterate `subscribers`, compute primary prompt for `today`, send message, `markPrimarySent`.
- If `primarySentAt` already set for today, skip (idempotent scheduler tick).

### Interaction with commands

- `/prompt`: compute primary for today; send even if not subscribed? **Decision: allow** (helps re-engagement); do not auto-subscribe.
- `/another`: require `canUseAlternate`; if false, reply with friendly limit message; else send alternate and `consumeAlternate`.
- `/start`: subscribe + send today’s prompt immediately (optional ticket STIL-12 — product choice).

### Persistence

**None in MVP.** On Render restart:

- All users must `/start` again to receive 8am pushes.
- `/another` quota resets (acceptable).

Document in `/start` and `/help`: “Remind me after server updates: send /start again.”

### Cleanup

- Purge `dailyState` keys older than 14 days on a timer to bound memory.

### Future migration

Replace store with:

- Render **Disk** mount + JSON file, or
- Postgres table `subscribers` + `daily_usage`

Keep the same interface to minimize handler churn.

## Consequences

- Simple, fast, no secrets beyond bot token.
- Not suitable for large scale or compliance-heavy retention policies.
- Single Render instance only; horizontal scaling requires shared store (future ADR).
