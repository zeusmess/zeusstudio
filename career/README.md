# Starbucks Career

The single-file Starbucks operations simulator, packaged as its own Android app named **Starbucks Career** (`com.youssefayman.starbuckscareer`). It installs next to Cup Catcher and does not replace it.

- `www/index.html` is the original page. The only edits are the name: the page title, the home-screen title and the header now say *Starbucks Career*.
- `scripts/vendor-assets.mjs` copies the page into `build/` and downloads its Tailwind script and Google Fonts next to it, so the installed app works offline.
- `scripts/build_icons.py` draws the launcher icons and splash screens (original art) into `android/`.

## Getting the APK

GitHub Actions builds it whenever `career/` changes (`.github/workflows/career-android.yml`). Open the run in the **Actions** tab and download it from **Artifacts**. Builds of the default branch are also published as the *Starbucks Career (Android)* release.

To build locally you need Node.js 20.19+, JDK 21 and the Android SDK:

```bash
cd career
npm install
npm run android:apk   # → android/app/build/outputs/apk/debug/app-debug.apk
```
