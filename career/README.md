# Starbucks Career

A store-operations and career game for Starbucks Egypt partners, built from the original single-page simulator and powered by Youssef Ayman. It runs on the web (direct link) and as an Android app (`com.youssefayman.starbuckscareer`) that installs next to Cup Catcher.

The owner's setup guide, in Arabic, is in [docs/SETUP.ar.md](docs/SETUP.ar.md).

## What is in the game

- **Opening screen**: sign in with Google, or register with a two-part name, employee ID and job title. Progress is saved on the device every 15 s and to the account every minute. The player's progress lives in `state.sbc`, which survives the in-game "reset the store".
- **1000 missions** in 10 chapters (`src/systems/missions`). Finishing all of them writes the player's name on the area managers' board.
- **Shift management** (`src/systems/shift`): three shifts a day, labour %, the Play Builder, Egypt's Labour Law 14/2025 rest rules, the Daily Records Book, opening and closing checklists, and a graded report for each shift.
- **Complex in-store problems** (`src/systems/incidents`): about 40 timed scenarios with authority by role, modifiers on the floor and consequences that arrive later.
- **Career ladder** (`src/systems/career`): Barista → Trainer → Supervisor → ASM → Store Manager → honorary Area Manager. Each step needs missions, KPIs from real shifts, a certificate exam and a panel interview.
- **Community**: the live players list, today's top 10 (resets at midnight Cairo time), the all-time top 10, and the hall of fame.
- **Owner panel** for accounts listed under `/career/admins`: announcements, events and a reward multiplier, maintenance, required and latest versions, links, problem rate, moderation, progress transfer and CSV export.

The branches, the area managers, Operations (أ. عمرو عاطف) and Training (أ. محمود أحمد) are unchanged from the original.

## Layout

```
index.html            the page (original markup plus the new tabs)
src/legacy/game.js    the original game as a module, with events and hooks
src/systems/          metrics, missions, shift, incidents, career, modifiers
src/ui/               opening screen, tabs, dialogs, owner panel
src/render/scene.js   characters, cars, machine effects, time-of-day light
src/platform/         Firebase, sign-in, saves, sync
database.rules.json   Realtime Database rules (everything under /career)
```

## Development

```bash
npm install
npm run dev              # against the Starbucks Career Firebase project
VITE_FIREBASE_OFFLINE=true npm run dev   # offline, progress on the device only
npm run emulators        # in another terminal: local Auth + Database emulators
npm run dev:emulators    # the game against the emulators
npm test                 # unit tests
npm run test:rules       # database rules against the emulator
npm run build            # dist/
```

The public Firebase web settings of the project are in `src/platform/firebase.public.js`; `VITE_FIREBASE_*` variables (`.env.local`, or `CAREER_FIREBASE_*` repository variables in CI) point the build at another project.

## Builds

- **APK**: `.github/workflows/career-android.yml` builds on every change under `career/`. It runs the unit tests, embeds the Firebase settings and signs with the fixed test key (`android/app/starbucks-career-test.keystore`), so each update installs over the previous one. Builds of the default branch are published as the `career-latest` release.
- **Web**: `.github/workflows/pages.yml` publishes the game at `https://<owner>.github.io/<repository>/career/`.
- **Google sign-in inside the app**: add the secret `CAREER_GOOGLE_SERVICES_JSON`. The workflow then adds `@capacitor-firebase/authentication`. Without it, the app offers registration by employee ID, and Google sign-in still works on the web.

This is a fan-made training game, not an official Starbucks app.
