# QA (owned by the Dev Manager)

The developer may run these but never edits them. Requires Node 22+ and Playwright with Chromium
(if Playwright is installed globally, prefix the commands with `NODE_PATH=$(npm root -g)`).

- `node qa/ai-check.js index.html`: exhaustive check of `window.TTT.chooseAIMove`. Covers every legal position for Easy, Medium and Hard against an independent reference, plus full game trees against Hard. Expect `failCount: 0` and `humanWins: 0`.
- `node qa/ui-check.js index.html <screenshot-dir>`: scripted T-001 flows, AI timings, double-click safety, 2-player regression, 375 px phone width and console errors. Expect every line to read PASS.

Baseline (T-001 build, Chromium): 0 AI failures, 33,504 games against Hard with 0 human wins, 41/41 UI checks.
