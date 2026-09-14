# ADR 0002: Prompt configuration format

- **Status:** Accepted
- **Date:** 2026-09-14
- **Supersedes:** —
- **Related:** [ADR 0001](./0001-daily-prompt-telegram-bot.md), [TICKETS.md](../TICKETS.md)

## Context

Developers must change daily words **without code deploys** beyond config edits. Prompts need:

- Global schedule metadata (timezone, daily time).
- **Random colors** as an initial content pool.
- **Letter-of-weekday** and **letter-of-month** word lists.
- Overrides at **day**, **week**, and **month** granularity.
- Deterministic selection per user per day (same primary prompt all day) with a **different** alternate pool for `/another`.

## Decision

Use **YAML** files under `config/prompts/` with a single entry manifest `config/prompts/manifest.yaml` pointing at active files. Validate on startup with **Zod**; fail fast with readable errors in logs (process exit in production).

### File layout

```text
config/prompts/
  manifest.yaml          # active profile + includes
  schedule.yaml          # timezone, dailyAt, phase timeline
  lists/
    colors.yaml
    by-letter.yaml       # A–Z buckets of common words
  overrides/
    days.yaml            # YYYY-MM-DD → explicit word or strategy
    weeks.yaml           # ISO week or "weekOfYear" rules (optional)
    months.yaml          # YYYY-MM or month name rules
```

MVP may ship as **one merged `prompts.yaml`** first; split files when lists grow (ticket STIL-05).

### Core schema (conceptual)

```yaml
version: 1
timezone: Asia/Singapore
dailyAt: "08:00"   # 24h local to timezone

# Which generator runs for a given calendar date (SGT)
phases:
  - id: colors
    from: "2026-09-01"
    until: "2026-09-30"      # inclusive; omit until = open-ended
    generator: randomColor
  - id: weekday-letter
    from: "2026-10-01"
    generator: weekdayInitial
  - id: month-letter
    from: "2026-11-01"
    generator: monthInitial

generators:
  randomColor:
    type: list
    words: [red, crimson, scarlet, ...]   # or include: lists/colors.yaml

  weekdayInitial:
    type: initialOfCalendarUnit
    unit: weekday          # English full name: Monday → M
    letterSource: firstCharacter
    wordList: by-letter    # key into lists/by-letter.yaml

  monthInitial:
    type: initialOfCalendarUnit
    unit: month            # September → S
    letterSource: firstCharacter
    wordList: by-letter

alternate:
  generator: randomColor   # fallback pool for /another
  excludePrimary: true     # do not repeat today's primary word

overrides:
  days:
    "2026-12-25": { word: "gold" }
  months:
    "2026-12": { generator: randomColor }   # whole month uses colors
  weeks:
    "2026-W42": { generator: weekdayInitial }
```

### Resolution algorithm (normative)

For calendar date `D` in `timezone`:

1. If `overrides.days[D]` defines `word`, primary prompt = that word (generator = `fixed`).
2. Else if an override exists for `D`’s ISO week in `overrides.weeks`, use that generator/word rules.
3. Else if an override exists for `D`’s month (`YYYY-MM` or month name), use that generator.
4. Else find the **phase** where `from <= D` and (`until` is absent or `D <= until`); use its `generator`.
5. **Primary selection seed:** `hash(userId + D + "primary")` for reproducibility per user per day **or** `hash(D + "primary")` if prompts should be identical for all users. **Decision: same word for all users on a given day** (`hash(D + "primary")`) to encourage shared community themes; `/another` uses `hash(userId + D + "alternate")` so alternates differ per user.

6. For `list` generators: index = seed mod list length (stable shuffle optional later).

7. For `initialOfCalendarUnit`: compute letter `L`, look up `by-letter[L]`; if missing or empty, fall back to `randomColor` and log warning.

8. `/another`: pick from `alternate` generator with seed `hash(userId + D + "alternate" + attemptNumber)` where `attemptNumber` is 1 for the single allowed daily alternate; enforce `excludePrimary`.

### Configurable by day / week / month (summary)

| Granularity | Key format | Effect |
|-------------|------------|--------|
| Day | `YYYY-MM-DD` | Fixed word or override generator |
| Week | ISO `YYYY-Www` | Override generator for that week |
| Month | `YYYY-MM` or `january` | Override generator or fixed list |

Week/month overrides do not replace day-level overrides; **day wins**.

### Developer workflow

1. Edit YAML in git.
2. Run `npm run validate:prompts` (to be added) locally.
3. Push → Render deploy → bot loads config at startup.

Optional: `PROMPTS_CONFIG_PATH` env var defaulting to `config/prompts/manifest.yaml`.

## Alternatives considered

| Option | Why not MVP |
|--------|-------------|
| Prompts only in env vars | Poor ergonomics for long word lists |
| Google Sheet / Notion API | External dependency, auth, latency |
| Database-backed prompts | Explicitly deferred |

## Consequences

- YAML typos can break deploy; validation script and CI check required (ticket STIL-06).
- Large word lists are safe in git; use split files for reviewability.
- English weekday/month names are assumed; localization is a future ADR.
