# T-005: iOS toolchain readiness report (read-only)

Status: IN REVIEW
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P2 | Size: XS

## Goal
Tell the Dev Manager what this Mac already has for building a native iOS app later (stage 2). **Install nothing and change nothing.**

## Report in `reports/T-005.md` (the command output, or "not installed")
- macOS version (`sw_vers`), chip (`uname -m`), free disk space (`df -h /`)
- Xcode: `xcodebuild -version` and `xcode-select -p` (Capacitor 8 and App Store uploads need Xcode 26+)
- Node and npm: `node -v`, `npm -v` (Capacitor 8 needs Node 22+)
- Homebrew: `brew --version`
- GitHub CLI: `gh --version`, `gh auth status`
- git identity: whether `user.name` / `user.email` are set (don't set them)
- Did T-002's push work without a sign-in prompt? (yes/no, and the error if not)

## Acceptance criteria
- [ ] AC-1 Every item is reported.
- [ ] AC-2 Nothing was installed, configured or changed.
