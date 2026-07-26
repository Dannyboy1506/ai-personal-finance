# AI Personal Finance

An offline-first personal finance tracker for Android, built with Expo/React
Native. Log a transaction as plain text ("spent 15 on uber") and a three-tier
AI pipeline turns it into a categorized, balanced ledger entry — mostly
on-device, falling back to cloud models only when it needs to.

## Architecture

This is a pnpm workspace monorepo:

```
artifacts/
  fintech-app/     Expo Router app — the actual product (React Native + TS)
  api-server/      Express backend — proxies AI calls, holds provider API keys
lib/
  db/              Drizzle ORM + Postgres schema (scaffolded, not yet in use)
  api-spec/        OpenAPI spec — source of truth for /parse, /audit, /status
  api-zod/         Generated Zod schemas (via orval, run `pnpm codegen` in lib/api-spec)
  api-client-react/ Generated React Query hooks (currently unused by the app)
```

**Why a backend for a "local-first" app?** Only for the two AI tiers that need
a real model. Everything else — accounts, transactions, goals, budgets,
recurring rules — lives entirely on-device in AsyncStorage. The backend never
sees or stores your financial data; it only relays a transaction description
or a weekly summary to OpenRouter/Gemini and returns the result. If you never
configure the backend, the app still works fully via Tier 1.

### The three-tier AI pipeline

| Tier | What it does | Where it runs | Needs backend? |
|---|---|---|---|
| 1 | Regex/keyword parsing of "spent 15 on uber" style input | On-device, instant | No |
| 2 | Fast structured parsing via OpenRouter (Llama 3.3 70B) when Tier 1 isn't confident | `api-server` → OpenRouter | Yes |
| 3 | On-demand "Deep Audit" — a short written financial review via Gemini 2.5 Flash | `api-server` → Gemini | Yes |

Tier 2/3 API keys live only as real environment variables on `api-server` —
never in the app bundle. See `artifacts/api-server/.env.example`.

## Setup

```bash
pnpm install
```

**Backend (optional, enables Tier 2/3):**
```bash
cd artifacts/api-server
cp .env.example .env   # fill in OPENROUTER_API_KEY / GEMINI_API_KEY
pnpm dev
```

**App:**
```bash
cd artifacts/fintech-app
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL to wherever api-server is reachable
npx expo start
```

Note the two new native dependencies (`@react-native-community/netinfo`,
`expo-file-system`, `expo-sharing`, `expo-document-picker`) were added with
best-guess version numbers. Run `npx expo install --fix` once after your
first `pnpm install` so Expo's CLI corrects them to whatever's actually
compatible with the installed SDK version.

## Building an APK

**Via GitHub Actions (no local Android setup needed):** push to `main`, or
run the *Build Android APK* workflow manually from the Actions tab. Download
the `.apk` from the finished run's Artifacts section. It's a debug build
(auto-signed with Android's debug key) — installable immediately via
`adb install` or by opening the file on-device, but not Play Store-ready.

Optionally set an `EXPO_PUBLIC_API_BASE_URL` repository secret so the built
app can reach your deployed backend. Without it, the APK still builds and
runs — Tier 1 only.

**Locally:**
```bash
cd artifacts/fintech-app
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

## Data & privacy

Everything (accounts, transactions, goals, budgets, recurring rules) is
stored only in AsyncStorage on your device — there's no cloud sync. Use
**Settings → Export data** to back up to a JSON file periodically; there's no
recovery path otherwise if the app is uninstalled or the device is lost.
When Tier 2/3 are configured, transaction text and weekly summaries are sent
to your backend and from there to OpenRouter/Gemini for processing — see the
in-app Settings screen for the current live status of each tier.

## Known gaps / deliberately deferred

- **Storage engine:** AsyncStorage works but doesn't scale gracefully past a
  few thousand transactions (every write re-serializes the full array) and
  isn't encrypted at rest. Migrating to `expo-sqlite` would fix both but is a
  large enough change to warrant its own focused pass with on-device testing,
  rather than being bundled in blind alongside everything else.
- **Backend deployment:** `api-server` needs to be deployed somewhere
  reachable by the app (Replit Deployments, Render, Fly.io, a VPS, etc.) for
  Tier 2/3 to work outside of local dev. This repo doesn't include deployment
  config for any specific host.
- **`lib/db` / `lib/api-client-react`:** still scaffolding. The Postgres
  schema is empty and nothing in the app calls the generated React Query
  hooks. Fine to leave as-is, or worth removing if you're confident you won't
  add server-side persistence later.
