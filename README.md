# STARBUCKS CUP CATCHER

**Catch Every Cup. Beat Every Level.** — a bilingual (Arabic / English), mobile-first arcade game **by Youssef Ayman**.

Move the basket, catch the falling drinks, chain combos, clear 15 levels, then chase high scores in Endless Mode or challenge a friend online with an invitation code.

> Fan-made game. Not affiliated with or endorsed by Starbucks Corporation. Starbucks, the Siren logo and the drink images are trademarks or property of Starbucks Corporation; they are shown only because they were supplied for this project. The brand-free edition leaves all of them out (see [Editions](#editions)); the app icon and favicon are original art in both.

---

## What's in the game

- **15 campaign levels** with targets of 500, 1,500, 2,500 … 14,500 points (+1,000 per level, each level scored on its own). Level 1 is a short guided tutorial; golden cups arrive at level 4, special cups at 6, things to avoid at 12, and level 15 ends with a final wave.
- **Scoring**: normal cup 100, golden 250, special 500. Quick catches build a combo multiplier (×1.5 → ×3), every 10 catches in a row pays a streak bonus, 20 in a row refills a life.
- **Victory sequence**: the game freezes, slows into a celebration, sweeps to green with the logo and a winking original mascot, confetti and a victory sound, then *LEVEL COMPLETED* with score, target, best and *Next Level / Replay / Main Menu*. Level 15 shows *CAMPAIGN COMPLETED*, campaign total, the final achievement and the Endless Mode unlock.
- **Endless Mode** (unlocked by finishing the campaign): waves that keep getting faster, golden rush waves, score milestones, device and global leaderboards.
- **Play With Friend**: real-time online matches — create a room, share the 6-character code (or link), both players get ready, the host starts, and both play the same cups on a shared clock. First to the target wins; otherwise the higher score when time runs out (equal scores tie). Rematch, leave (forfeit), disconnect handling.
- **Profiles**: guest play with no account, or Google sign-in that carries guest progress into the account and syncs it across devices. Names in Arabic or English, 12 avatars, 6 basket skins, statistics, 12 achievements (with cosmetic rewards) and match history.
- **Arabic and English** with full right-to-left layout, Arabic plural rules and the same Western digits in both languages. The playfield and the ◀ ▶ buttons are never mirrored.
- **Controls**: drag anywhere (touch or mouse), ← → or A D, optional on-screen buttons. Pause with the button, P or Esc; the phone's back gesture pauses instead of leaving.
- **Sound**: synthesized effects and lo-fi music (no third-party audio files), separate music / effects volume and mute.
- **Accessibility**: reduced motion (system setting or in-game), labelled controls, nothing communicated by colour alone, keyboard play, focus kept inside dialogs.
- Installable as an app (web manifest and icons).

## Quick start

Requires **Node.js 20.19+** (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173 — single player works with no setup
```

Without Firebase settings the game is fully playable as a guest; Google sign-in, online matches and the global leaderboard clearly say they are *awaiting configuration* — nothing pretends to work.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run build:single` | The brand-free edition as one self-contained HTML file in `dist-single/` |
| `npm run preview` | Serve the production build |
| `npm run check` | Type-check, lint, unit tests and build in one go |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | oxlint, plus a check that rejects invisible / bidi-control characters in the source |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rules` | Database security rules in the Firebase emulator |
| `npm run test:e2e` | Browser tests, mobile and desktop (Playwright) |
| `npm run test:e2e:multiplayer` | Two separate browsers play an online match against the emulators |
| `npm run emulators` | Start the Auth + Realtime Database emulators with the rules loaded (keeps running) |
| `npm run dev:emulators` | Development server that talks to those emulators |
| `npm run rules:build` | Regenerate `database.rules.json` from `src/multiplayer/databaseRules.ts` |
| `npm run simulate -- 40 casual,normal,skilled` | Balance simulation: clear rate and time per level |
| `npm run assets:brand` | Re-process supplied brand images into `public/assets/brand` (Python + Pillow) |
| `npm run assets:icons` | Regenerate favicon, app icons and Android icons/splash screens from the original emblem |
| `npm run android:sync` | Build the game and copy it into the Android project |
| `npm run android:apk` | …and build a debug APK (needs the Android SDK) |

The Firebase emulators need Java 21+ (the CLI downloads the emulators themselves on first run). Playwright needs its Chromium: `npx playwright install chromium` if it is not already installed.

## Project structure

```
src/
  app/            App shell, state machine (INITIALIZING … MATCH_RESULTS), settings, back-button handling
  audio/          Web Audio engine: synthesized effects and music
  auth/           Firebase loading, Google sign-in, guest/anonymous accounts
  components/     Shared UI: Button, Card, Dialog, Notice, Screen, controls, avatars, toasts…
  game/
    core/         Deterministic simulation (GameSession, 120 Hz fixed step, seeded RNG, constants)
    systems/      Spawner, motion, scoring, collisions, basket
    levels/       The 15 level configurations, Endless and online match presets
    scenes/       Phaser renderer (draws the simulation; never decides outcomes)
    art/          Original SVG art (cups, basket skins, avatars, emblem) and the art each edition uses
    GameController.ts, bot.ts, hudStore.ts
  locales/        en.json, ar.json (brand-free text), brand/ (the Starbucks edition's name and legal lines), typed i18n helpers
  multiplayer/    Room codes, match rules, room service, lobby/match coordinator, database rules source
  profile/        Profiles, progress, achievements, cosmetics, validation, cloud sync
  screens/        Opening, level select, sign-in, profile, settings, achievements, leaderboard, lobby, game
  services/       Configuration, editions, storage, leaderboard
  styles/         Design tokens (single source for CSS and the canvas) and global styles
android/          Capacitor Android project (the APK wraps the same web build)
.github/workflows Android APK builds (both apps), GitHub Pages deployment
career-simulator/ A separate game: Starbucks Career & District Simulator, one HTML page and its Android app
scripts/          Rules builder, emulator harness, balance simulator, icon and brand-asset builders, Vite plugins (editions, single file)
tests/            rules/ (emulator) and e2e/ (Playwright); unit tests sit next to the code in src/
database.rules.json  Generated security rules (do not edit by hand)
```

## Editions

| | Starbucks edition (default) | Brand-free edition |
| --- | --- | --- |
| Name | STARBUCKS CUP CATCHER · صيّاد أكواب ستاربكس | CUP CATCHER · صيّاد الأكواب |
| Pictures | The drink photos and logo supplied for this project (`public/assets/brand`) | The original illustrations only |
| Legal lines | Fan-made disclaimer and trademark notice | None needed |
| Build | `npm run build` | `VITE_BRAND_ASSETS=off npm run build`, or `npm run build:single` |

The edition is fixed at build time, so the brand-free output contains no Starbucks text (kept apart in `src/locales/brand/`) and no brand photos; the build fails if any output file still mentions the brand. That edition can be shared or published without Starbucks' permission.

`npm run build:single` writes the brand-free edition as a single HTML file (`dist-single/index.html`, about 2.3 MB, with the scripts, styles, fonts and artwork inside). It runs from a double-click or on any host that takes one page. Like any build, it has online features only when the `VITE_FIREBASE_*` values are set, and Google sign-in also needs its domain authorized in Firebase, so not from a file opened directly.

## Firebase setup (Google sign-in, online play, global leaderboard)

1. Create a project at <https://console.firebase.google.com> and add a **Web app**. Copy its settings into `.env.local` (start from `.env.example`). They are public web settings, not secrets — **never** put a service account key or other private credential in any `VITE_` variable.
2. **Authentication → Sign-in method**: enable **Google** and **Anonymous** (guests play online through anonymous accounts, which upgrade in place when they sign in with Google).
3. **Authentication → Settings → Authorized domains**: add every domain the game is served from (e.g. `your-project.web.app`, your own domain).
4. **Realtime Database**: create a database (locked mode is fine) and deploy the rules:
   ```bash
   npx firebase login
   npx firebase use --add          # pick the project
   npx firebase deploy --only database
   ```
5. Restart `npm run dev`. The menu's Google button, Play With Friend and the global leaderboard are now live.

### How online matches stay fair

The browser never decides a result on its own. `database.rules.json` (generated from `src/multiplayer/databaseRules.ts`, with the game's own constants) is the referee:

- only the two players in a room can read it or write to it; a third player cannot join; rooms expire;
- the host can start only when both players are ready, on the server's clock;
- every catch claims one cup id that can score only once; its points are capped for the match length; the stored score can only rise by exactly those points; cups cannot be claimed before they could have fallen; scores cannot outpace what the elapsed time allows (`src/multiplayer/matchBounds.ts`, tested against a flawless simulated player);
- a result is accepted only if it agrees with the stored scores (target reached, higher score at the time limit, or a forfeit by the player who left or has been offline for 15 s), and once a result exists the scores are frozen.

### Try online play locally

```bash
npm run emulators           # terminal 1: Auth + Database emulators with the rules
npm run dev:emulators       # terminal 2: the game, connected to them
```

Open http://localhost:5173 in two different browsers (or one normal and one private window): create a room in one, join with the code in the other.

## Deployment (Firebase Hosting)

```bash
npm run check                                  # type-check, lint, tests, build
npx firebase deploy --only hosting,database     # serves dist/ with the SPA rewrite and cache headers in firebase.json
```

Any static host works for the game itself: the build uses relative paths, so `dist/` can be served from a site root or a sub-path. Add the final domain to Firebase's authorized domains for Google sign-in.

### GitHub Pages

`.github/workflows/pages.yml` publishes the web version to `https://<owner>.github.io/<repository>/`. It does nothing until Pages is turned on:

1. **Settings → Pages → Source: GitHub Actions.** (For a private repository, Pages needs a paid GitHub plan; otherwise make the repository public.)
2. **Actions → Web (GitHub Pages) → Run workflow.** To publish on every push to the default branch, add the repository variable `PAGES_ENABLED=true`.

To enable sign-in and online play there, add the `VITE_FIREBASE_*` values as repository **variables** (Settings → Secrets and variables → Actions → Variables) and the Pages domain to Firebase's authorized domains.

## Android app (APK)

The Android app wraps the same web build in a [Capacitor](https://capacitorjs.com) shell (`android/`, app id `com.youssefayman.cupcatcher`, label *Cup Catcher* / *صيّاد الأكواب*, portrait, the original emblem as icon and splash).

- **Without installing anything:** every push runs `.github/workflows/android.yml`, which builds a debug APK on GitHub's servers. Builds of the default branch are published as the *Android test build* release, always at `https://github.com/<owner>/<repository>/releases/download/android-latest/cup-catcher-debug.apk` (sign in to GitHub first while the repository is private). Every run also keeps the APK under *Artifacts* in the **Actions** tab.
- **Locally** (Android Studio or the Android SDK, JDK 21): `npm run android:apk` → `android/app/build/outputs/apk/debug/app-debug.apk`. `npm run android:sync` copies a fresh web build into the project (e.g. before opening `android/` in Android Studio).

Installing a debug APK on a phone needs *Install unknown apps* allowed for the browser or file manager used to open it. It is signed with a debug key: for Google Play, build a signed release (`./gradlew bundleRelease` with your own keystore) — and note that store listings using Starbucks' name and logo would need Starbucks' permission. `VITE_BRAND_ASSETS=off npm run android:sync` packs the brand-free edition instead.

Inside the app, Google doesn't allow its sign-in page in embedded browsers, so the app offers guest play (progress stays on the phone) and points to the web version for Google sign-in; online matches work in the app once Firebase is configured.

## Starbucks Career & District Simulator

`career-simulator/` holds a second, unrelated game: an Arabic idle career game, from Barista to District Manager, written as one HTML page (`career-simulator/web/index.html`), with a native Android app around it. It has its own build (`.github/workflows/career-simulator.yml`) and instructions in [career-simulator/README.md](career-simulator/README.md).

## Tests

| Suite | Command | Covers |
| --- | --- | --- |
| Unit (119) | `npm test` | Level targets and +1,000 steps, scoring, combos and streaks, no double scoring, missed cups, single victory / game-over events, restart, determinism, fairness of all 15 levels, endless waves, match time limits, room codes, join checks, start rules, winner calculation, server score bounds vs perfect play, rules file up to date, translations parity and placeholders, Arabic plurals, RTL/LTR switching, state machine, saving across reloads, corrupted and tampered storage, duplicate saves, sync merges, name validation, missing Firebase configuration |
| Security rules (33) | `npm run test:rules` | Membership, joining, readiness, starting, catch reporting, score tampering, results, rematch, leaving, leaderboard — in the Realtime Database emulator |
| Browser (14 × mobile + desktop) | `npm run test:e2e` | Intro and menus, honest unconfigured states, language switch and persistence, unmirrored controls, clearing a level and saving it, pause/resume/restart/quit, keyboard, game over, profile names, axe accessibility checks in both languages |
| Two-browser multiplayer | `npm run test:e2e:multiplayer` | Create, invalid/unknown/full codes, join, ready, start, shared seed, agreed result, match history, rematch, forfeit |

## Balance

Measured with `npm run simulate -- 40 casual,normal,skilled` (simulated players that only move the basket, 40 runs per level). Times are for a cleared level; real players also spend time on retries.

| Level | Target | Normal player: cleared | median time | Skilled player: median time |
| --- | ---: | ---: | ---: | ---: |
| 1 (tutorial) | 500 | 100% | 28 s | 28 s |
| 2 | 1,500 | 100% | 53 s | 51 s |
| 3 | 2,500 | 100% | 69 s | 69 s |
| 4 | 3,500 | 98% | 81 s | 81 s |
| 5 | 4,500 | 100% | 91 s | 88 s |
| 6 | 5,500 | 100% | 98 s | 97 s |
| 7 | 6,500 | 100% | 99 s | 97 s |
| 8 | 7,500 | 100% | 106 s | 102 s |
| 9 | 8,500 | 100% | 107 s | 104 s |
| 10 | 9,500 | 95% | 119 s | 113 s |
| 11 | 10,500 | 98% | 121 s | 111 s |
| 12 | 11,500 | 78% | 123 s | 120 s |
| 13 | 12,500 | 73% | 124 s | 119 s |
| 14 | 13,500 | 73% | 137 s | 132 s |
| 15 | 14,500 | 53% | 152 s | 136 s |

A casual player clears levels 1–6 most of the time and finds level 7 onwards a real challenge. Level length comes from the pace of the cups rather than padding, so the early levels (2–4) run about 1–1½ minutes and the late ones about 2–2½ minutes per attempt.

## Known limitations

- **Google sign-in** is implemented with Firebase Auth (popup, with a redirect fallback). Its popup could not be exercised in the development sandbox because Google's servers were unreachable there; the account flow after sign-in (guest progress carried over, cloud sync, restore on another device, sign-out) was verified against the Firebase Auth emulator. It needs a real Firebase project to be tried end to end.
- **Anti-cheat** is enforced by database rules, not by a game server: scores must be consistent and physically possible, but a modified client could still play "perfectly" within those bounds. Full replay validation would need a server (e.g. Cloud Functions) re-running the seeded simulation.
- If a player reloads the page during a live online match, they rejoin the room but not the running round; the round finishes on time or by the other player's target.
- Old rooms are not deleted automatically; the rules allow anyone to remove rooms older than two hours (a scheduled cleanup can do this).
- Tested in Chromium (mobile and desktop emulation). Not yet verified on physical iOS Safari or Android devices, or with screen readers beyond automated axe checks.
