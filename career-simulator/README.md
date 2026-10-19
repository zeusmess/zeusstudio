# Starbucks Career & District Simulator · محاكي مسيرة ستاربكس

An idle/clicker career game in Arabic: serve drinks, finish shift tasks and missions, buy upgrades and get promoted from Barista to District Manager after 1,000 hard tasks. Here it is packaged as an Android app.

> Fan-made game. Not affiliated with or endorsed by Starbucks Corporation; "Starbucks" and the drink names are its trademarks. The app icon is original art (no Starbucks logo). A store listing under this name would need Starbucks' permission.

```
career-simulator/
  web/index.html   the whole game: one page, no other files (open it in a browser to play)
  android/         the Android app: one Activity that shows web/index.html in a WebView
```

## Get the APK

- **From GitHub:** every push that changes `career-simulator/` runs `.github/workflows/career-simulator.yml`, which builds the APK on GitHub's servers and keeps it under *Artifacts* in the **Actions** tab. Builds of the default branch are also published as the *Career Simulator* release, always at `https://github.com/<owner>/<repository>/releases/download/career-simulator-latest/starbucks-career.apk`.
- **On your computer** (Android Studio, or the Android SDK with JDK 17+):
  ```bash
  cd career-simulator/android
  ./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release.apk
  ```
  Or open `career-simulator/android` in Android Studio and press Run.

To install, allow *Install unknown apps* for the browser or file manager you open the APK with.

Every build is signed with the same key (`android/app/debug.keystore`, password `android`), so a newer APK installs over an older one and keeps the saved game. That key is a test key and is not secret. For Google Play, sign with a key of your own and keep it out of the repository.

## The app

- Android 7.0 (API 24) or newer, built for Android 16 (API 36). About 160 KB. No libraries, no ads, no tracking. It works offline: nothing leaves the phone.
- The page is served from `https://appassets.androidplatform.net/` inside the app, not from `file://`, so the game has a normal web origin and the WebView cannot read files.
- Edge to edge on every Android version: the strip behind the status bar takes the header's green and the strip behind the navigation bar takes the tab bar's white. The keyboard pushes the page up instead of covering the name field.
- **Back** returns to the first tab. From the first tab, the app goes to the background like Home does, so the game is still there when you reopen it.
- **Saving:** the game saves into the page's storage and also into the app's own storage on the phone (`AndroidSave` bridge). On load, whichever copy is newer wins. Android's backup keeps the app's copy too.
- If WebView's process crashes or Android reclaims it for memory, the app starts a new WebView and reloads the game from its save instead of closing. If Android System WebView is missing or disabled, the app says so instead of crashing.
- Portrait, text size fixed at the page's design size, no zoom, no tap highlight, no automatic dark recolouring.

## What changed in the game page

The page is the original design with these fixes:

- **Missions** now require the drinks they name (30, 50, 100, 180 drinks served since the start of the game). Each shows its progress, and a mission locked until then shows how many drinks are left. Before, any mission could be claimed at once, which made the 1,000 hard tasks a few taps away.
- **Shift tasks** rest after use: Duty Roster every 30 s, QASA Audit every 120 s, Safe Handover every 60 s. Each shows its countdown, which survives a reload. Before, they could be tapped without limit. The intervals are the `cooldown` values in `SHIFT_TASKS` (`0` turns one off).
- **The rank badge** (Barista Trainer, Shift Supervisor, Store Manager) is kept after a reload. It used to go back to Barista.
- **Passive income** is paid for the real time that passed, so it stays right when the phone slows or pauses the page. It also keeps coming while the game is closed, for up to 8 hours (`MAX_AWAY_SECONDS`), with a message on return.
- **Upgrade buttons** become available as money arrives. Before, a button stayed disabled until the next tap.
- **Saves:** an old, partial or damaged save loads without breaking the game. Saves from the first version (`sb_career_save_v1`) still load.
- **District Managers:** a name is shown exactly as typed. Before, a name containing `<` was read as HTML. Confirming the promotion twice no longer adds the district and the +$1,500/s twice. Enter confirms the name.
- **Reading order:** counts like "15 / 25" and "$20/s" now read correctly inside the Arabic text. They used to show reversed ("25 / 15").
- Smaller fixes: the reward line says +2 hard tasks (it said +1), the same drink is never ordered twice in a row, a new message replaces the previous one instead of being cut short, and money and costs have thousands separators.
