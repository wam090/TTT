# T-001: Choose game mode (1 Player vs AI, or 2 Players)

Status: READY
Author: Dev Manager | Owner: Developer | Created: 2026-09-27 | Priority: P1 | Size: M

## Goal
When a new game starts, the player chooses **1 Player (vs AI)** or **2 Players (same device)**. vs AI has three difficulty levels.

## Why
Today the game needs two people, so a solo mode lets one person play. A perfect tic-tac-toe AI can't be beaten, so the difficulty levels are what make the mode fun: Easy to learn on, Medium to beat with a trick, Hard to hold to a draw.

## How it works today (reference)
First load shows only **New Game**. New Game -> colour picker (Player X, then Player O) -> board. X always starts. After a game: laser/shake/confetti, then the action row shows **New Game** (which is really an instant rematch with the same colours) and the colour wheel (change colours).

## New flow
1. First load: unchanged. Title + **New Game** only.
2. **New Game** -> **Mode** step (same card slot, look and slide animations as the colour picker):
   - Title "Choose a mode"
   - `1 Player` (caption "vs AI") -> Difficulty step
   - `2 Players` (caption "same device") -> step 4
3. **Difficulty** step: title "Choose difficulty"; buttons `Easy`, `Medium`, `Hard` (caption "Unbeatable"); a `‹ Back` button returns to the Mode step. Tapping a difficulty continues to step 4.
4. Then the same as today: colour picker if colours haven't been chosen yet this session, otherwise straight to the board.
   - In vs AI the picker has one step, titled "You: pick a colour". The AI's colour is set automatically and never equals the human's: keep the AI's current colour unless it collides, otherwise take the first free palette colour.
5. End of game: the action row shows **Rematch**, **New Game** and the colour wheel.
   - Rematch: restart immediately with the same mode, difficulty and colours.
   - New Game: back to the Mode step.
   - Colour wheel: as today (in vs AI only the human picks).
6. When the Mode/Difficulty steps reopen, pre-highlight the last choice (in memory only; no localStorage).

## vs AI rules
- Human = X, AI = O.
- The first game after New Game: the human moves first. Each Rematch alternates who moves first. (2 Players is unchanged: X always starts.)
- AI turn: status shows "AI is thinking…" (`&hellip;`), the board ignores clicks, and the AI moves after a random 400–700 ms delay with the same placement animation as a human move. If the AI moves first, its first move comes after the board's entrance animation has finished.
- Status texts in vs AI: "Your turn" / "AI is thinking…" / "You win!" / "AI wins" / "It’s a draw". 2 Players texts are unchanged.
- Win effects: laser + shake on every win. Confetti only when a human wins (always in 2 Players; in vs AI only when the human wins).

## AI behaviour: implement exactly
A "winning move" is a move that completes a line of three for that mark.
- **Easy**: (1) If the AI has a winning move, play it. (2) Otherwise play a uniformly random empty cell. Never deliberately blocks.
- **Medium**: (1) Winning move, if any. (2) Else block the human's winning move (if there are two, block either). (3) Else the centre (4), if empty. (4) Else a random empty corner (0, 2, 6, 8). (5) Else a random empty edge (1, 3, 5, 7). No look-ahead, so a fork beats it. That's intended.
- **Hard**: perfect play with full minimax (alpha-beta optional). Score an AI win as +(10 − depth), a human win as −(10 − depth) and a draw as 0, so it wins as fast as possible and loses as late as possible. Break ties between equally good moves randomly via `rng`. It must never lose.

## Test hook (required; the Dev Manager's QA depends on it)
```js
window.TTT = { chooseAIMove: chooseAIMove };
// chooseAIMove(board, aiMark, difficulty, rng) -> index 0-8 of an empty cell
//   board       Array(9) of '' | 'X' | 'O'  (same format as the game's board)
//   aiMark      'X' | 'O'                   (the other mark is the human)
//   difficulty  'easy' | 'medium' | 'hard'
//   rng         optional function returning [0, 1); default Math.random. ALL randomness goes through it.
// Pure: never mutates board, no DOM, no timers. Only called when the game isn't over.
// Must return in < 50 ms for any position, including the empty board.
```
Element ids (QA drives the UI through these): `#modeAiBtn`, `#mode2pBtn`, `#diffEasyBtn`, `#diffMediumBtn`, `#diffHardBtn`, `#diffBackBtn`, `#rematchBtn`. `#newGameBtn` keeps its id. All of them are real `<button>` elements.

## Acceptance criteria
Flow
- [ ] AC-1 First load looks and behaves exactly as today.
- [ ] AC-2 New Game always opens the Mode step; 1 Player leads to Difficulty; ‹ Back returns to Mode.
- [ ] AC-3 After Mode (and Difficulty), the picker/board flow matches "New flow" step 4.
- [ ] AC-4 The vs AI picker asks only the human; the AI's colour never equals the human's, including after using the colour wheel.
- [ ] AC-5 The last mode and difficulty are pre-highlighted when the steps reopen.

vs AI
- [ ] AC-6 Human is X. The human moves first after New Game; each Rematch alternates the first mover.
- [ ] AC-7 AI turn: "AI is thinking…", the board ignores clicks, 400–700 ms delay, same placement animation.
- [ ] AC-8 Status texts exactly as listed; 2 Players texts unchanged.
- [ ] AC-9 Laser + shake on every win; confetti only when a human wins.
- [ ] AC-10 Easy, Medium and Hard behave exactly as "AI behaviour" defines.
- [ ] AC-11 Hard never loses, whoever starts.
- [ ] AC-12 The AI never moves twice in a row, never moves after a game has ended, and never plays an occupied cell, including when Rematch/New Game or cells are double-clicked or tapped quickly.

End of game
- [ ] AC-13 The action row shows Rematch, New Game and the colour wheel. Rematch keeps mode, difficulty and colours; New Game goes to the Mode step.

Regression and quality
- [ ] AC-14 2 Players plays exactly as before (X starts, both players pick colours, same texts and effects).
- [ ] AC-15 No console errors. Works in Chrome and Safari, desktop and mobile. No horizontal scroll at 375 px.
- [ ] AC-16 Test hook and element ids exactly as specified.
- [ ] AC-17 Still one `index.html`, no libraries, code style matches the file.

## Out of scope: don't build
Scoreboard, online play, sound, saving settings across reloads, restart/quit during a game, any change to 2 Players behaviour. Put ideas under *Suggestions* in your report.

## Pointers (hints, not orders)
- `launchBoard()` hard-codes `turn = 'X'`; the first mover has to come from state.
- `onCellClick()` needs a guard against human clicks during the AI's turn; after a human move that doesn't end the game, schedule the AI.
- `newGameBtn` currently rematches when colours already exist. That behaviour moves to `#rematchBtn`.
- A double-click can run `sinkActions()` twice today (two callbacks). Make the action buttons ignore clicks while the row is sinking.
- Keep a single handle for the pending AI timer and clear it in `launchBoard()`.

## Definition of done
All ACs met and self-tested, commits prefixed `T-001:`, `reports/T-001.md` written, Status set to `IN REVIEW`.
