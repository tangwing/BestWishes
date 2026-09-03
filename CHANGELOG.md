# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed

- Consent gate before composing (B-50): a new user who opened 写祝福 from the nav was never routed through the agreement page — `GET /api/agreement/current` always returns 200, so Compose's consent check never fired, and submit failed with a 403 whose message was a small line at the bottom of a long form (looked like nothing happened). `AgreementView` now carries `alreadyConsented`; Compose redirects to `/agreement` on entry when it's false, and also on a `consent_required` error from submit. Covered by a new api-flow assertion and an E2E test (verified to fail without the fix).

### Changed

- 「坚持」page renamed to 「回响」(B-51): reframed around 送人玫瑰手有余香 — the cumulative count of blessings sent is the headline; the consecutive-days number is demoted to one soft line, dropping the habit-tracker pressure that clashed with the product's "不必赶" tone. Client copy only; the domain `streak` module is unchanged.
- Sent page (B-52) now states the recipient just opens the link — no registration, no login — since P1 has no in-app user→user delivery.

### Added

- Project scaffolding: README, AGENTS.md, PROMPT_LOG, ADR/product doc structure.
- OpenSpec adopted as the requirement lifecycle tool (Spec → review → TDD → implementation), see [ADR 0002](docs/adr/0002-openspec-for-requirement-lifecycle.md). Adds `openspec/` and `.claude/commands/opsx/*` + `.claude/skills/openspec-*`.
- Product vision / North Star (`docs/product/vision.md`): mission, positioning (a "focus + goodwill" space anchored to mindfulness, explicitly not a religious tool), and 5 design tie-breaker principles.
- `docs/product/concept.md` updated (v4): beachhead as a go-to-market wedge only, P1 scope locked (text-only blessings + personalization + shareable card, no AI eval, no funds), funds deferred to P3 with a licensed-custody / anti-"二清" direction, bounty framed strictly as service reward (not fundraising).
- `docs/product/capabilities.md` (v0): backend capability map — 15 domains (C1–C15) plus cross-cutting non-functionals, tagged by rollout phase; C3/C4/C9/C13 refined per research.
- `docs/research/` convention added (AGENTS.md §5, README); first report `docs/research/2026-09-01-funds-ai-licensing.md` — China funds-compliance, AI quality-evaluation, and UGC-licensing findings with an ADR checklist (ADR-A…ADR-Q).
- `docs/product/use-cases.md` (v0): P1 use cases (P1-UC-01…14), key data objects, and open questions for review.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) (Proposed): P1 tech stack — Web-first (React + TS + Vite PWA, Node + TS backend, PostgreSQL), WeChat web OAuth, pluggable `ModerationProvider`; mini-program deferred to a post-P2 decision point.
- `docs/architecture/p1-architecture.md`: P1 component view, blessing state machine, publish-then-verify / delayed-delivery model, streak rollback rules, data model, API sketch.
- openspec change `add-p1-text-blessing`: proposal + 6 capability spec deltas (wx-account, content-agreement, blessing-authoring, blessing-delivery, content-moderation, blessing-streak) + design + tasks; passes `openspec validate --strict`.
- `prototype/`: runnable P1 walkthrough spike (React PWA + pure-function domain modules) with 101 passing tests. Not production code.
- `docs/design/p1/`: P1 UI walkthrough as a Claude Design canvas (9 mobile artboards).
- `docs/product/p1-acceptance-status.md`: per-use-case status of P1 acceptance criteria against the prototype.
- `docs/architecture/` and `docs/design/` conventions added (AGENTS.md §5); `.gitignore` now ignores `node_modules/`, `dist/`.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) moved to Accepted (core items): D1 Web-first PWA, D4 Node.js+TS, D6 PostgreSQL, D10 rule-based moderation for P1; includes a long-term-fitness review.
- `docs/engineering/coding-standards.md` (v1): the technical code standard all production code must follow — layering, TypeScript, comments, API/DB conventions, concurrency & performance, security, testing, review checklist.
- Git workflow: `.claude/hooks/auto-commit-push.sh` (Stop hook) auto-commits and pushes to `main` after every turn; AGENTS.md §7 documents it.
- `coding-standards.md`: §7.1 mandates plain human-language comments (no marketing / "AI-register" phrasing); §3.1 adds architecture fitness-function tests (dependency-cruiser + `*.arch.test.ts`) as an independent suite run first in CI.
- `prototype/`: architecture tests wired up — `.dependency-cruiser.cjs` + `src/arch/architecture.arch.test.ts`, `test:arch` and `verify` scripts. `npm run verify` green (typecheck + arch + 108 tests + build).
- **P1 初版 Demo（生产 monorepo）**: `packages/domain` (pure logic) + `packages/shared` (Zod/error codes) + `server/` (Fastify, hexagonal layers, in-memory repos, scan jobs, static hosting) + `client/` (React + Vite + CSS Modules, 10 pages) + `arch/` (architecture tests). `pnpm demo` runs the whole flow single-process; `pnpm verify` green (typecheck, 0 dependency-cruiser violations, 119 tests incl. 7 `app.inject` end-to-end, build, eslint, prettier). openspec change `add-p1-text-blessing` §1–§7 implemented; `validate --strict` passes. Data layer is in-memory — PostgreSQL, real WeChat auth, real content-safety API are in BACKLOG. Walkthrough: `docs/DEMO.md`.
- `BACKLOG.md` (root): running task list + work-resume anchor. AGENTS.md / CLAUDE.md now say to read it at session start. Working method (point-by-point review iteration, parallel agents) added as AGENTS.md §8.
- PostgreSQL data layer (B-24): Drizzle schema for all 10 P1 tables (`server/src/infrastructure/db/schema.ts`), generated migration (`server/drizzle/`), and a full `Repositories` implementation against Drizzle (`server/src/infrastructure/pg/pg-repositories.ts`) sharing the same ports as the in-memory version — blessing events live in their own table and are rehydrated on read. Runs on PGlite (Postgres compiled to WASM, in-process, no local Postgres install needed); `BW_DB=pglite` selects it, in-memory stays the default. 5 integration tests run the whole application stack against real SQL, in-process, CI-safe. Swapping to a standalone Postgres in production is a one-layer driver change. Homebrew on this machine can't build Postgres (`openssl@3: unknown keyword :overwrite`), hence PGlite.
- Playwright end-to-end tests (B-30): standalone `e2e/` (own npm, not in the workspace). Drives the system-installed Chrome (`channel: 'chrome'`) because Playwright no longer ships a chromium build for macOS 12. `webServer` builds the client and starts the server with a 1-second delivery hold. 6 tests: author flow (login → profile → agreement → compose with paste blocked → sent → auto-publish → visitor sees content → withdraw → visitor sees placeholder), moderation (guardrail-word hold → queue → pass → delivered; high-risk report → takedown → appeal → restored), visitor (unknown link placeholder, no login needed), smoke. `pnpm test:e2e` runs them; not part of `pnpm verify`.
- Design canvas v2 approved (B-09).
- `docs/product/p1-acceptance-status.md` rewritten against the production monorepo (B-31): per-use-case evidence now points at real files and tests in `packages/domain` / `server/` / `client/` / `e2e/`, a new data-layer / deployment section, and a refreshed "pending your call" list (ADR 0003 accepted, openspec change awaiting archive, timing of real WeChat / moderation APIs, `prototype/` removal).
- Design review round 1 folded into spec + canvas + prototype: compose form trimmed to 3 sender fields (给谁 / 落款 / 城市), templates are reference-only (no one-click fill, body must be typed, paste blocked), an intention-setting prompt before writing; new `user-profile` capability (个人空间) pre-sets 落款 / 城市 / preferences; "我的祝福" → "收发记录" with outbox (P1) + inbox (empty state, `blessing-records` capability). openspec change now covers 8 capabilities; `openspec validate --strict` green. Prototype `npm run verify` green (108 tests). Canvas republished (v2, +个人空间 artboard).
