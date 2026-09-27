# T-006: Final release v3: board drop-in fix, publish to GitHub `main`

Status: READY
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P1 | Size: S

## Goal
Wrap TTT up: one tiny fix, then publish the final web app as **v3** on GitHub `main`. GitHub Pages already serves the repo at https://wam090.github.io/TTT/, so the push is the release. This is the last task; after it, TTT is frozen.

## Context
- Dev Manager QA passed on 5e15c08 (T-003 + T-004): AI check 0 failures, UI check 41/41, offline over http passes (also with `?utm=` links), no console errors. T-003 and T-004 are DONE.
- GitHub `main` and `dev` are both at 394fa78 `v2` (the CEO's push); your later commits are local only. Pushing works from this Mac without a prompt (T-005).

## Steps
1. **Fix, the only code change:** after any win, the next board must drop in again. In `launchBoard()`, clear `shake` together with `drop` (your finding in reports/T-004.md). Nothing else in the game changes.
2. **Self-test:** win vs AI, then Rematch, then New Game: each new board drops in and doesn't shake. A win still shakes the board. With Reduce Motion: still no shake and no confetti. Re-run the AI check and your ported T-001 UI checks. No console errors.
3. **Commit** the fix with the message `v3: final version (board drops in again after a win)`.
4. **Publish**, fast-forward only:
   - `git fetch origin`. `git merge-base --is-ancestor origin/main HEAD` and `git merge-base --is-ancestor origin/dev HEAD` must both succeed. If either fails: stop, set `BLOCKED`, explain in the report.
   - `git tag -a v3 -m "TTT v3: final version"` on HEAD.
   - `git push origin dev`, then `git push origin dev:main`, then `git push origin v3`. Never `--force`. Don't touch other branches (`TTT_v0.1`, `TTT_v0.2`), other tags or repo settings.
   - Verify with `git ls-remote origin refs/heads/main refs/heads/dev refs/tags/v3`: `main` and `dev` at the v3 commit, and the `v3` tag present.
5. **Report** in `reports/T-006.md` (the v3 hash and the `ls-remote` output), set Status to `IN REVIEW`, commit as `T-006: report`, and push `dev` only. `main` stays on the v3 commit.

If a push is refused: don't change git config or credentials and don't retry in a loop. Put the exact error in the report, set `BLOCKED`, and tell the CEO: "Publishing v3 needs your GitHub sign-in. The Dev Manager has the details."

## Acceptance criteria
- [ ] AC-1 After a win, the next board drops in (after Rematch and after New Game); a win still shakes; Reduce Motion unchanged.
- [ ] AC-2 No regressions: AI check 0 failures, your ported UI checks all pass, no console errors.
- [ ] AC-3 `origin/main` and `origin/dev` were fast-forwarded to the v3 commit; tag `v3` points at it; `origin/dev` then also has the report commit.
- [ ] AC-4 No force push; no other branch, tag or setting changed.

## Out of scope: don't build
Anything else: new features, README, a version label in the game, renaming the `sw.js` cache (`ttt-v1` stays; this is its first release), the native app.
