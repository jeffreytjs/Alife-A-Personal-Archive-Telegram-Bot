# Implementation tickets — Alife - A Personal Archive

Track these as GitHub Issues (label `alife-personal-archive`) or your project board. IDs are stable references (`STIL-XX`).

**Architecture:** [adr/README.md](./adr/README.md)

**Milestones**

| Milestone | Goal | Tickets |
|-----------|------|---------|
| M1 — Prompt engine | Config loads; words resolve for any SGT date | STIL-01 – STIL-07 |
| M2 — Bot UX | Subscribe, commands, media acknowledgment | STIL-08 – STIL-14 |
| M3 — Scheduler | 8:00 SGT broadcast on Render | STIL-15 – STIL-18 |
| M4 — Ship | Deploy, docs, BotFather, smoke tests | STIL-19 – STIL-22 |
| M5 — Future | Categories, persistence, export | STIL-23 – STIL-28 |

**Definition of done (all tickets)**

- TypeScript builds (`npm run build:bot`).
- Behavior covered by manual test steps in ticket or automated test where noted.
- No secrets committed; env documented in `.env.example` if new vars added.
- User-facing copy mentions **8:00 SGT** and once-daily `/another`.

---

## Epic A — Product & documentation

### STIL-01 — Product one-pager in README

**Priority:** P1 · **Milestone:** M4 · **ADR:** 0001

**Description:** Replace template-centric README intro with product vision: one word daily, photo/video habit, montage narrative, no web/DB in MVP.

**Acceptance criteria**

- [ ] README describes commands, 8am SGT, config-based prompts, Render-only deploy.
- [ ] Links to `docs/adr/` and this ticket file.
- [ ] Mini App marked optional/disabled for MVP.

**Dependencies:** None

---

### STIL-02 — BotFather command list & description

**Priority:** P1 · **Milestone:** M4 · **ADR:** 0001

**Description:** Set BotFather `/setcommands`, description, and about text aligned with MVP commands.

**Acceptance criteria**

- [ ] Commands: `start`, `stop`, `prompt`, `another`, `help`, `about`.
- [ ] App startup `setMyCommands` matches BotFather (existing template behavior).
- [ ] Description mentions daily photo/video prompt at 8am Singapore time.

**Dependencies:** STIL-08 (command handlers exist)

---

## Epic B — Prompt configuration

### STIL-03 — Add starter prompt config (colors + by-letter lists)

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002

**Description:** Add `config/prompts/prompts.yaml` (or manifest + includes) with:

- Color list (≥ 24 entries).
- `by-letter` buckets A–Z with ≥ 5 common words each (reasonable English nouns/adjectives).
- Phase timeline starting with `randomColor`, then `weekdayInitial`, then `monthInitial` (dates per product owner).

**Acceptance criteria**

- [ ] File(s) committed and documented in ADR 0002 layout.
- [ ] `alternate` pool configured with `excludePrimary: true`.

**Dependencies:** None

---

### STIL-04 — Zod schema for prompt config

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002

**Description:** Implement `src/prompts/schema.ts` validating version, timezone, phases, generators, overrides.

**Acceptance criteria**

- [ ] Invalid config produces aggregated Zod error messages.
- [ ] Unit tests for at least 3 invalid fixtures and 1 valid fixture.

**Dependencies:** STIL-03

---

### STIL-05 — Prompt loader (`loadPromptConfig`)

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002

**Description:** Load YAML from `PROMPTS_CONFIG_PATH` (default `config/prompts/prompts.yaml`), parse, validate, expose immutable config object.

**Acceptance criteria**

- [ ] Called once at bot startup; failure exits process in production.
- [ ] Supports `include` or single-file MVP per ADR.

**Dependencies:** STIL-04, add `yaml` dependency

---

### STIL-06 — `npm run validate:prompts` + CI

**Priority:** P1 · **Milestone:** M1 · **ADR:** 0002

**Description:** Script validates default config path without starting Telegram; add to `npm test` or GitHub Actions workflow.

**Acceptance criteria**

- [ ] Script exits 0 on valid config, 1 on invalid.
- [ ] CI job runs on PR (if repo uses GitHub Actions).

**Dependencies:** STIL-05

---

## Epic C — Prompt resolution engine

### STIL-07 — SGT date helpers

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002, 0003

**Description:** Centralize `todayInTimezone('Asia/Singapore')`, `formatDateKey`, ISO week key for overrides.

**Acceptance criteria**

- [ ] Tests around DST boundaries (Singapore has no DST; still test UTC rollover near 08:00 SGT).
- [ ] All prompt/subscriber keys use same helper.

**Dependencies:** Pick `luxon` or `@js-temporal/polyfill` (document in ticket PR)

---

### STIL-08 — `resolvePrimaryPrompt(date, config)`

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002

**Description:** Implement override precedence: day → week → month → phase; generators `list`, `initialOfCalendarUnit`, `fixed`.

**Acceptance criteria**

- [ ] Same date → same primary word for all users (seed `hash(date + "primary")`).
- [ ] Missing letter bucket falls back to color list + `warn` log.
- [ ] Table-driven tests for: fixed day override, weekday **M**, month **S**, phase transition dates.

**Dependencies:** STIL-05, STIL-07

---

### STIL-09 — `resolveAlternatePrompt(date, userId, primary, config)`

**Priority:** P0 · **Milestone:** M1 · **ADR:** 0002

**Description:** Alternate generator with per-user seed; must not equal primary when `excludePrimary: true` (if pool size > 1).

**Acceptance criteria**

- [ ] Deterministic for same user+date.
- [ ] If only one word available, reply with clear message (edge case test).

**Dependencies:** STIL-08

---

## Epic D — In-memory state

### STIL-10 — Subscriber store module

**Priority:** P0 · **Milestone:** M2 · **ADR:** 0003

**Description:** Implement subscribe/unsubscribe/list and daily state maps per ADR 0003.

**Acceptance criteria**

- [ ] Unit tests for subscribe idempotency, alternate consumption, primary sent idempotency.
- [ ] TTL cleanup for keys older than 14 days.

**Dependencies:** STIL-07

---

### STIL-11 — Remove or slim template conversation memory

**Priority:** P2 · **Milestone:** M2 · **ADR:** 0001

**Description:** Product does not need `/memory` history. Remove commands and strip echo memory writes from handlers, or gate behind env `ENABLE_CONVERSATION_MEMORY=false` default off.

**Acceptance criteria**

- [ ] No user message content stored by default.
- [ ] `/memory` and `/forget` removed or hidden from help.

**Dependencies:** STIL-12

---

## Epic E — Telegram handlers & UX

### STIL-12 — Command handlers (`/start`, `/stop`, `/prompt`, `/another`, `/help`, `/about`)

**Priority:** P0 · **Milestone:** M2 · **ADR:** 0001, 0003

**Description:** Replace template commands in `src/bot/handlers/commands.ts`.

**Acceptance criteria**

- [ ] `/start` subscribes + explains 8am SGT + optional immediate today prompt (document choice in PR).
- [ ] `/stop` unsubscribes.
- [ ] `/prompt` returns formatted primary prompt for today.
- [ ] `/another` enforces once per SGT day; friendly error on second use.
- [ ] Rate limiting still applies.

**Dependencies:** STIL-08, STIL-09, STIL-10

---

### STIL-13 — Media message handler

**Priority:** P1 · **Milestone:** M2 · **ADR:** 0001

**Description:** On photo/video/document (video), reply with short encouragement (no upload storage). Ignore plain text or reply with “use /prompt” hint.

**Acceptance criteria**

- [ ] Handles `photo`, `video`, `video_note` optionally.
- [ ] Does not call `addMessage` with media binary metadata beyond type.

**Dependencies:** STIL-12

---

### STIL-14 — Prompt message formatter

**Priority:** P2 · **Milestone:** M2 · **ADR:** 0001

**Description:** Shared template for daily push and commands: word, date SGT, one-line creative guidance, `/another` hint.

**Acceptance criteria**

- [ ] Used by scheduler and `/prompt` / `/another` / optional `/start` prompt.

**Dependencies:** STIL-12

---

## Epic F — Scheduling

### STIL-15 — Cron scheduler 08:00 Asia/Singapore

**Priority:** P0 · **Milestone:** M3 · **ADR:** 0001

**Description:** Add `src/jobs/dailyPromptJob.ts` using `node-cron` `0 8 * * *` with timezone option; register from `BotManager.start`.

**Acceptance criteria**

- [ ] Logs next run time at startup (debug).
- [ ] Sends to all subscribers via Telegram API with backoff on 429.
- [ ] Skips duplicate primary send per chat per day (store).

**Dependencies:** STIL-10, STIL-14, STIL-08

---

### STIL-16 — Broadcast error handling

**Priority:** P1 · **Milestone:** M3 · **ADR:** 0001

**Description:** If send fails (blocked bot, deactivated user), remove chat from subscribers or mark inactive after 403.

**Acceptance criteria**

- [ ] Log reason; do not crash scheduler loop.
- [ ] Test with mocked Telegram 403.

**Dependencies:** STIL-15

---

### STIL-17 — Manual job trigger (development only)

**Priority:** P2 · **Milestone:** M3 · **ADR:** 0001

**Description:** Env-guarded `POST /internal/jobs/daily-prompt` or npm script invoking job for local QA.

**Acceptance criteria**

- [ ] Disabled in production unless `ENABLE_DEV_JOB_ENDPOINT=true`.
- [ ] Documented in LOCAL_DEVELOPMENT.md.

**Dependencies:** STIL-15

---

### STIL-18 — Startup behavior note (no catch-up)

**Priority:** P2 · **Milestone:** M3 · **ADR:** 0001

**Description:** Document and implement: no mass catch-up on deploy after 08:00; users use `/prompt`.

**Acceptance criteria**

- [ ] `/help` documents behavior.
- [ ] Scheduler does not backfill missed days.

**Dependencies:** STIL-15

---

## Epic G — Deploy & operations

### STIL-19 — Update `render.yaml` and `.env.example`

**Priority:** P0 · **Milestone:** M4 · **ADR:** 0001, 0002

**Description:** Set `BOT_DISPLAY_NAME`, `WEB_APP_ENABLED=false`, optional `PROMPTS_CONFIG_PATH`, `TZ` note (process still uses Asia/Singapore in code).

**Acceptance criteria**

- [ ] `.env.example` documents all new vars.
- [ ] DEPLOYMENT.md section for this product (no Vercel required).

**Dependencies:** STIL-05

---

### STIL-20 — Render smoke test checklist

**Priority:** P1 · **Milestone:** M4 · **ADR:** 0001

**Description:** Extend `docs/DEPLOYMENT.md` with product-specific verification steps.

**Acceptance criteria**

- [ ] Steps: `/health`, `/start`, `/prompt`, temp cron or wait for 8am, `/another` limit.
- [ ] Reminder to `/start` after redeploy.

**Dependencies:** STIL-15, STIL-12

---

### STIL-21 — Logging & observability baseline

**Priority:** P2 · **Milestone:** M4 · **ADR:** 0001

**Description:** Structured logs for job start/end, subscriber count, config version, prompt date.

**Acceptance criteria**

- [ ] No tokens or PII in logs beyond numeric chat id at debug level.

**Dependencies:** STIL-15

---

### STIL-22 — Package metadata rename

**Priority:** P3 · **Milestone:** M4 · **ADR:** 0001

**Description:** Rename `package.json` name/description from template to `alife-archive-telegram-bot`.

**Acceptance criteria**

- [ ] Keywords updated; author unchanged unless owner requests.

**Dependencies:** None

---

## Epic H — Future (post-MVP)

### STIL-23 — Prompt categories

**Priority:** future · **ADR:** 0002 extension

**Description:** Optional `category` on generators (e.g. color, nature, emotion); user preference command `/category` — **deferred**.

**Acceptance criteria**

- [ ] ADR amendment or ADR 0004 before implementation.

---

### STIL-24 — Persist subscribers (Postgres or disk)

**Priority:** future · **ADR:** 0003 supersession

**Description:** Survive Render restarts; single-instance scheduler remains until cron extraction.

---

### STIL-25 — Developer `/reload` command

**Priority:** future · **ADR:** 0001

**Description:** Allowlisted Telegram user IDs reload config without full redeploy.

---

### STIL-26 — Export / montage helper

**Priority:** future · **ADR:** 0001

**Description:** Document manual Telegram export or bot command linking to ffmpeg workflow; no server storage requirement initially.

---

### STIL-27 — Render Cron Job + secret header

**Priority:** future · **ADR:** 0001

**Description:** External trigger for 8am job if in-process cron proves unreliable on free tier spin-down.

---

### STIL-28 — Web interface removal or archive

**Priority:** future · **ADR:** 0001

**Description:** Remove `web-interface/` from default clone or move to `examples/mini-app` to reduce noise.

---

## Suggested implementation order

```text
STIL-03 → STIL-04 → STIL-05 → STIL-07 → STIL-08 → STIL-09
    → STIL-10 → STIL-12 → STIL-14 → STIL-13 → STIL-15 → STIL-16
    → STIL-06 → STIL-19 → STIL-20 → STIL-01 → STIL-02 → STIL-11
```

**Parallelizable:** STIL-07 with STIL-04; STIL-22 anytime.

---

## Test plan (M4 gate)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | New user `/start` | Subscribed; welcome + prompt behavior per STIL-12 |
| 2 | `/prompt` twice same day | Same primary word |
| 3 | `/another` twice same day | Second attempt rejected |
| 4 | `/another` after midnight SGT | Allowed again |
| 5 | Phase date boundary | Word follows new generator per config |
| 6 | Day override in YAML | Fixed word on that date |
| 7 | User sends photo | Encouragement reply, no storage |
| 8 | Redeploy Render | Subscribers empty until `/start`; `/prompt` still works |
| 9 | 08:00 SGT tick | All subscribers receive primary (manual or STIL-17) |
| 10 | Invalid YAML in deploy | Build or startup fails loudly (STIL-06) |

---

## GitHub issue import (optional)

Create labels: `epic/A-prompt`, `epic/B-bot`, `epic/C-scheduler`, `priority/P0`.

For each `STIL-XX` section, open an issue with title `[STIL-XX] …` and paste description + acceptance criteria checklist.

**Epic tracking issue bodies** can link child issues with task lists:

```markdown
- [ ] STIL-03 …
- [ ] STIL-04 …
```
