# T-004: iPhone-ready: install to the Home Screen, full screen, offline

Status: IN REVIEW
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P1 | Size: M

## Goal
On an iPhone, the game installs from Safari to the Home Screen and then feels like an app: its own icon, full screen with no browser bars, works offline, none of the web-page quirks (zoom, text selection, grey tap flashes, page bounce), clears the notch and the home indicator, and remembers your settings. This is stage 1 of the iOS plan. Everything here is reused later, when the game is wrapped as a native App Store app.

## Context
- It will be served from GitHub Pages at a sub-path (https://wam090.github.io/TTT/), so every URL must be relative. No leading `/`.
- `icons/` is provided by the Dev Manager: `icon-1024.png` (App Store, later), `icon-512.png`, `icon-192.png`, `apple-touch-icon.png` (180 px). Don't edit them; if you need another size, ask in your report.
- This task allows two new files next to `index.html`: `manifest.webmanifest` and `sw.js`. The game itself stays in `index.html`.

## Scope
1. **Install and full screen**
   - `manifest.webmanifest`: `name` and `short_name` "Tic Tac Toe"; `start_url` and `scope` "./"; `display` "standalone"; `orientation` "portrait"; `background_color` and `theme_color` = the page background; icons 192 and 512 (`purpose` "any"), plus 512 again as `"maskable"`.
   - In `<head>`: the manifest link; `apple-touch-icon`; `apple-mobile-web-app-title` "Tic Tac Toe"; `apple-mobile-web-app-status-bar-style` "black-translucent"; `mobile-web-app-capable` and `apple-mobile-web-app-capable` "yes"; `theme-color`; a viewport with `viewport-fit=cover`.
2. **Offline** (`sw.js`)
   - After one online visit, the game opens and plays with no network.
   - A new release reaches the phone by the second launch after it's published, at the latest. The cache name is versioned, and old caches are deleted on activate.
   - Register the service worker only when served over http(s) (check `location.protocol`), so opening `index.html` as a local file keeps working, and so will the future native wrapper.
3. **Feels like an app, not a web page**
   - No double-tap zoom (`touch-action: manipulation`), no text selection or long-press callout, no grey tap highlight, no page bounce (`overscroll-behavior: none`).
   - Content clears the notch/Dynamic Island and the home indicator in full-screen mode (`env(safe-area-inset-*)`).
   - Portrait fits without scrolling from iPhone SE (375×667) to Pro Max (440×956), in every state: mode, difficulty, picker, board and end-of-game row. Landscape must stay usable (scrolling is fine there).
   - Every tappable control is at least 44×44 CSS px (Apple's minimum). Today `‹ Back` and the colour wheel are smaller.
   - With the phone's Reduce Motion setting on (`prefers-reduced-motion: reduce`): no board shake and no confetti. Everything else is unchanged.
4. **Remembers settings**
   - Mode, difficulty and colours survive closing and reopening the app (`localStorage`, every access in `try/catch`). If storage is unavailable, the game behaves exactly as in T-001.
   - The first screen is unchanged (New Game). Saved choices show pre-highlighted, and saved colours skip the picker, just as chosen colours do within a session today.

## Acceptance criteria
- [ ] AC-1 `manifest.webmanifest` is valid JSON with the fields above; every icon it names exists; all paths are relative.
- [ ] AC-2 `<head>` has every tag listed in scope 1.
- [ ] AC-3 Served over http: after one load, the game loads and plays with the network off (the Dev Manager tests this). The cache is versioned and old caches are removed.
- [ ] AC-4 Opened as a local file (`file://`): works as today, with no console errors.
- [ ] AC-5 No zoom, selection, callout, tap highlight or bounce, as in scope 3.
- [ ] AC-6 Safe areas are handled with `env(safe-area-inset-*)`, with no overlap in full-screen mode (checked on the CEO's iPhone).
- [ ] AC-7 Fits without scrolling at 375×667 and 440×956 in every state.
- [ ] AC-8 Every tappable control is ≥ 44×44 CSS px.
- [ ] AC-9 Reduce Motion: no shake, no confetti.
- [ ] AC-10 Mode, difficulty and colours are restored after a reload; storage that throws breaks nothing.
- [ ] AC-11 No regressions: every T-001 criterion still holds, and the QA hooks and ids are unchanged (the Dev Manager re-runs the T-001 QA).
- [ ] AC-12 Still no libraries, CDNs or build step; the only new files are `manifest.webmanifest` and `sw.js`.

## Out of scope: don't build
The native app / Xcode (stage 2), the App Store listing, sound, haptics (Safari on iPhone can't vibrate), iPad-specific layout, and turning on GitHub Pages (that's part of the next release task).
