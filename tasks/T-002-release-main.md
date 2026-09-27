# T-002: Release: publish `dev` to GitHub `main`

Status: BLOCKED
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P1 | Size: S

## Goal
Publish the reviewed build to GitHub (`origin` = github.com/wam090/TTT) so that `main` and `dev` both carry it.

## Steps
1. Finish step 1 of `check`: commit the manager files, including the new `.gitignore`, `icons/` and `qa/`, in one `pm: sync manager files` commit. `Claude outputs/` is ignored on purpose (the Claude app saves files there). The tree must then be clean. Run `git fetch origin`.
2. Confirm this is the build the Dev Manager reviewed: `git rev-parse HEAD:index.html` must print `acc697148100f4c4dec0b8d2381863c162b67057`. If it doesn't, stop: set `BLOCKED` and explain.
3. Confirm both pushes are fast-forwards: `git merge-base --is-ancestor origin/main HEAD` and `git merge-base --is-ancestor origin/dev HEAD` must both succeed. If either fails, stop: `BLOCKED`.
4. `git push origin dev`, then `git push origin dev:main`. Never `--force`. Don't touch other branches, tags or repo settings.
5. Verify with `git ls-remote origin refs/heads/main refs/heads/dev`: both must show the hash from `git rev-parse HEAD`.
6. Write `reports/T-002.md` (release hash plus the `ls-remote` output), set Status to `IN REVIEW`, commit, and push `dev` only. `main` stays on the release commit.

If a push is refused for sign-in or permissions: don't change git config or credentials, and don't retry in a loop. Put the exact error in the report, set `BLOCKED`, and tell the CEO: "Publishing needs your GitHub sign-in on this Mac. The Dev Manager has the details."

## Acceptance criteria
- [ ] AC-1 `origin/main` is the release commit, and `git rev-parse origin/main:index.html` prints the hash in step 2.
- [ ] AC-2 `origin/dev` contains the release commit (plus the report commit).
- [ ] AC-3 No force push; no other branch, tag or setting changed.

## Out of scope
Tags, GitHub Releases, README, changing the default branch.
