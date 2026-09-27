# T-003: Polish: small fixes from the T-001 review

Status: READY
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P2 | Size: S

## Scope
1. Colour swatches ignore taps while the card slides. Today, in 2 Players, a tap during the slide-out after Confirm can give O the same colour as X.
2. The AI never places its mark in a cell that is still popping in (possible today if the human moves within ~0.4 s of the board appearing): its reply waits until that cell's entrance has finished.
3. The end-of-game timers (confetti, action row) go through one cancellable handle that `launchBoard()` clears, like `aiTimer`.
4. The colour wheel's tooltip is fully visible on a 375 px phone.

## Acceptance criteria
- [ ] AC-1 to AC-4: the four items above.
- [ ] AC-5 No regressions: every T-001 criterion still holds (the Dev Manager re-runs the T-001 QA).
