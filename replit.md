# AI Personal Finance

An offline-first personal finance tracker: log spending in plain text, a
three-tier AI pipeline (on-device → OpenRouter → Gemini) categorizes it, and
the app tracks accounts, budgets, goals, and recurring transactions locally.

## Run & Operate

- `pnpm --filter @workspace/fintech-app exec expo start` — run the app (Expo dev server)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, not currently used by the app)
- Required env (app): `EXPO_PUBLIC_API_BASE_URL` — where api-server is reachable (see `artifacts/fintech-app/.env.example`)
- Required env (server): `OPENROUTER_API_KEY`, `GEMINI_API_KEY` — both optional, each tier degrades gracefully if unset (see `artifacts/api-server/.env.example`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- App: Expo SDK 54, Expo Router v6, React Native 0.81, React 19
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (scaffolded, not currently wired to the app)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle) for the server; the GitHub Actions workflow
  (`.github/workflows/build-apk.yml`) for the Android APK

## Where things live

- `artifacts/fintech-app/context/FinanceContext.tsx` — the single source of
  truth for all app state (accounts, transactions, goals, budgets, recurring
  rules, sync queue). Everything persists to AsyncStorage from here.
- `artifacts/fintech-app/services/tier1Engine.ts` — on-device regex/keyword
  parser, always runs first.
- `artifacts/fintech-app/services/tier2Service.ts` / `tier3Service.ts` —
  thin clients that call `api-server`'s `/api/parse` and `/api/audit`.
- `artifacts/api-server/src/routes/` — `parse.ts` (Tier 2 proxy), `audit.ts`
  (Tier 3 proxy), `status.ts` (reports config without exposing keys).
- `lib/api-spec/openapi.yaml` — source of truth for the API surface.
- `attached_assets/BUILD_PLAN_*.md` — the original product/architecture plan.
  The app's actual stack (Expo/RN + AsyncStorage) diverges from what that
  document specifies (Flutter/Dart + SQLite/Drift) — the plan was the
  starting brief, not a literal spec of what got built.

## Architecture decisions

- **AI keys never ship to the client.** Tier 2/3 calls are proxied through
  `api-server`, which holds `OPENROUTER_API_KEY`/`GEMINI_API_KEY` as real
  (non-`EXPO_PUBLIC_`) env vars. Earlier versions called OpenRouter/Gemini
  directly from the app using `EXPO_PUBLIC_*` keys, which Expo inlines into
  the compiled JS bundle — recoverable from any built APK. Don't reintroduce
  that pattern.
- **AsyncStorage, not SQLite, despite the original plan.** Simpler to ship,
  fine at the current data scale. Revisit if/when transaction volume grows
  large enough that full-array rewrites on every mutation become noticeable,
  or if at-rest encryption becomes a requirement.
- **`lib/db`, `lib/api-client-react` are unused scaffolding**, kept in case
  server-side persistence gets added later. Nothing in the app calls them —
  don't assume they're wired up just because they're present.
- **Sync queue drains on reconnect, not on a timer.** `useNetworkStatus`
  (NetInfo) detects the offline→online transition and calls
  `drainSyncQueue()` once, rather than polling.
- **Recurring transactions materialize on app-foreground, not via a
  background task.** No `expo-task-manager`/background fetch is configured;
  `checkRecurringDue()` runs once on load and catches up (capped at 12 runs
  per rule) if the app was closed past a due date.

## Product

- Fast-log a transaction as free text; Tier 1 parses it instantly offline,
  falling back to Tier 2 (OpenRouter) when confidence is low, then to an
  offline sync queue if there's no connection at all.
- Accounts, categories, budgets (with spend-vs-limit tracking), and goals
  (with on-track/behind/at-risk pacing).
- Recurring transactions (salary, subscriptions, rent) auto-log on schedule.
- On-demand "Gemini Deep Audit" — a short written review of weekly spending
  with two concrete suggestions.
- Local export/import (Settings → Export/Restore) as the only backup path,
  since there's no cloud sync.

## User preferences

- Prefers complete, working implementations over stubs/TODOs — this repo has
  none by design; anything not finished should be described as such rather
  than left as a silent placeholder.
- Prefers receiving only what changed, not full project re-exports.

## Gotchas

- New native deps (`@react-native-community/netinfo`, `expo-file-system`,
  `expo-sharing`, `expo-document-picker`) were added to `package.json` with
  best-guess versions. Run `npx expo install --fix` after `pnpm install` to
  let Expo correct them to the SDK-54-compatible versions.
- `api-server` must actually be deployed and reachable for Tier 2/3 to work —
  setting `EXPO_PUBLIC_API_BASE_URL` alone isn't enough if nothing is running
  at that URL.
- The OpenAPI spec (`lib/api-spec/openapi.yaml`) now documents `/parse`,
  `/audit`, `/status`, but `api-server` implements them with hand-written
  validation rather than orval-generated Zod schemas — run
  `pnpm --filter @workspace/api-spec run codegen` and wire it up if you want
  those endpoints going through the generated-client pipeline like the rest
  of the codebase eventually should.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
