// Dev Manager QA for T-001: UI flows, timings, double-click safety, 2P regression, phone width.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const results = [];
const errors = [];
const check = (id, ok, detail) => results.push({ id, ok: !!ok, detail: detail === undefined ? '' : detail });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winMove(b, m) {
  for (const l of L) { const v = l.map(i => b[i]); if (v.filter(x => x === m).length === 2 && v.includes('')) return l[v.indexOf('')]; }
  return -1;
}
// Human (X) policies
const forkPolicy = b => { let w = winMove(b, 'X'); if (w >= 0) return w; w = winMove(b, 'O'); if (w >= 0) return w; for (const s of [0, 8, 2, 6, 1, 3, 5, 7, 4]) if (!b[s]) return s; };
const losePolicy = b => { for (const s of [1, 3, 5, 7, 0, 2, 6, 8, 4]) if (!b[s] && winMove(b, 'O') !== s) return s; return b.indexOf(''); };

async function newPage(context, label) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(label + ' ' + m.type() + ': ' + m.text()); });
  await page.addInitScript(() => {
    window.__builds = 0; window.__buildT = []; window.__marks = []; window.__confetti = 0; window.__lasers = 0; window.__maxW = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const board = document.getElementById('board');
      new MutationObserver(recs => {
        for (const r of recs) {
          for (const n of r.addedNodes) {
            if (r.target === board && n.classList && n.classList.contains('cell') && n.dataset.index === '0') { window.__builds++; window.__buildT.push(performance.now()); }
            if (n.classList && n.classList.contains('laser')) window.__lasers++;
            if (r.target.classList && r.target.classList.contains('cell') && n.nodeName.toLowerCase() === 'svg') {
              window.__marks.push({ t: performance.now(), i: +r.target.dataset.index, m: n.innerHTML.indexOf('circle') >= 0 ? 'O' : 'X', build: window.__builds });
            }
          }
        }
      }).observe(board, { childList: true, subtree: true });
      new MutationObserver(recs => { for (const r of recs) for (const n of r.addedNodes) if (n.classList && n.classList.contains('confetti-canvas')) window.__confetti++; })
        .observe(document.body, { childList: true, subtree: true });
      const tick = () => { window.__maxW = Math.max(window.__maxW, document.documentElement.scrollWidth, document.body.scrollWidth); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  });
  await page.goto(FILE);
  await sleep(400);
  return page;
}

const vis = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s); if (!el) return false;
  let e = el; while (e) { if (e.classList && e.classList.contains('hidden')) return false; if (getComputedStyle(e).display === 'none') return false; e = e.parentElement; }
  return true;
}, sel);
const status = page => page.evaluate(() => document.getElementById('status').textContent);
const title = page => page.evaluate(() => document.getElementById('pickerTitle').textContent);
const boardState = page => page.evaluate(() => [...document.querySelectorAll('#board .cell')].map(c => { const s = c.querySelector('svg'); return s ? (s.innerHTML.indexOf('circle') >= 0 ? 'O' : 'X') : ''; }));
const disabledCells = page => page.evaluate(() => [...document.querySelectorAll('#board .cell')].map(c => c.disabled));
const counters = page => page.evaluate(() => ({ builds: window.__builds, confetti: window.__confetti, lasers: window.__lasers, maxW: window.__maxW }));
const colours = page => page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { x: s.getPropertyValue('--x-main').trim(), o: s.getPropertyValue('--o-main').trim() }; });
const endRow = page => page.evaluate(() => [...document.querySelectorAll('#actions > *')].filter(e => !e.classList.contains('hidden')).map(e => e.id));
const isOver = s => /win|draw/i.test(s);

async function waitStatus(page, pred, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const s = await status(page); if (pred(s)) return s; await sleep(15); }
  return await status(page);
}

// Plays one vs AI game with a human policy; returns a record of what happened
async function playAI(page, policy, label) {
  const rec = { label, sneakBlocked: true, thinkingShown: true, lockedOnAITurn: true, startedBy: null };
  await sleep(100);
  const st0 = await waitStatus(page, s => s === 'Your turn' || s.startsWith('AI is thinking'));
  rec.startedBy = st0 === 'Your turn' ? 'human' : 'ai';
  if (rec.startedBy === 'ai') rec.lockedOnAITurn = (await disabledCells(page)).every(Boolean);
  for (let guard = 0; guard < 12; guard++) {
    const s = await waitStatus(page, x => x === 'Your turn' || isOver(x));
    if (isOver(s)) break;
    const b = await boardState(page);
    const n = b.filter(Boolean).length;
    await page.locator('#board .cell').nth(policy(b)).click();
    const s2 = await status(page);
    if (isOver(s2)) break;
    if (!s2.startsWith('AI is thinking')) rec.thinkingShown = false;
    if (!(await disabledCells(page)).every(Boolean)) rec.lockedOnAITurn = false;
    // A sneaky tap during the AI's turn must place nothing
    const b2 = await boardState(page);
    const free = b2.indexOf('');
    if (free >= 0) await page.evaluate(i => document.querySelectorAll('#board .cell')[i].click(), free);
    if ((await boardState(page)).filter(Boolean).length !== n + 1) rec.sneakBlocked = false;
  }
  rec.final = await waitStatus(page, isOver);
  rec.board = (await boardState(page)).map(v => v || '.').join('');
  return rec;
}

// AI reply and opening delays from the in-page timestamps
async function delays(page) {
  return page.evaluate(() => {
    const out = { replies: [], openings: [] };
    const byBuild = {};
    for (const m of window.__marks) (byBuild[m.build] = byBuild[m.build] || []).push(m);
    Object.keys(byBuild).forEach(k => {
      const ms = byBuild[k];
      if (ms[0].m === 'O') out.openings.push(Math.round(ms[0].t - window.__buildT[k - 1]));
      for (let j = 1; j < ms.length; j++) if (ms[j].m === 'O' && ms[j - 1].m === 'X') out.replies.push(Math.round(ms[j].t - ms[j - 1].t));
    });
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();

  /* ===== Desktop: vs AI ===== */
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let p = await newPage(desk, 'desktop');
  check('AC-1 first load: only New Game visible', (await vis(p, '#newGameBtn')) && !(await vis(p, '#rematchBtn')) && !(await vis(p, '#wheelBtn')) && !(await vis(p, '#picker')) && !(await vis(p, '#board')) && (await status(p)) === '');
  await p.screenshot({ path: OUT + '/d01-first-load.png' });

  await p.dblclick('#newGameBtn'); await sleep(800);
  check('AC-2 New Game (double-clicked) opens Mode step', (await vis(p, '#modeStep')) && !(await vis(p, '#diffStep')) && !(await vis(p, '#swatches')) && !(await vis(p, '#confirmBtn')) && (await title(p)) === 'Choose a mode', await title(p));
  await p.screenshot({ path: OUT + '/d02-mode.png' });
  await p.click('#modeAiBtn'); await sleep(800);
  check('AC-2 1 Player -> Difficulty step', (await vis(p, '#diffStep')) && (await vis(p, '#diffBackBtn')) && (await title(p)) === 'Choose difficulty');
  await p.screenshot({ path: OUT + '/d03-difficulty.png' });
  await p.click('#diffBackBtn'); await sleep(800);
  check('AC-2 Back -> Mode step', (await vis(p, '#modeStep')) && (await title(p)) === 'Choose a mode');
  check('AC-5 mode pre-highlighted after Back', await p.evaluate(() => document.getElementById('modeAiBtn').classList.contains('selected') && !document.getElementById('mode2pBtn').classList.contains('selected')));
  await p.click('#modeAiBtn'); await sleep(800);
  await p.click('#diffMediumBtn'); await sleep(800);
  check('AC-4 vs AI picker: one step, human only', (await title(p)) === 'You: pick a colour' && await p.evaluate(() => [...document.querySelectorAll('#swatches .swatch')].every(s => !s.disabled)), await title(p));
  await p.screenshot({ path: OUT + '/d04-picker-ai.png' });
  await p.locator('#swatches .swatch').nth(1).click(); // Pink = the AI's default
  await p.dblclick('#confirmBtn'); await sleep(1000);
  const c1 = await colours(p);
  check('AC-4 AI colour != human colour (human took Pink)', c1.x !== c1.o && c1.x === '#f472b6', c1);
  check('AC-12 double-clicked Confirm builds one board', (await counters(p)).builds === 1, (await counters(p)).builds);

  // Game 1: Medium, human first, fork trap -> human should win
  const cnt0 = await counters(p);
  const g1 = await playAI(p, forkPolicy, 'G1 medium, fork trap');
  await p.screenshot({ path: OUT + '/d05-human-win.png' });
  await sleep(600); // confetti launches 300 ms after the win
  const cnt1 = await counters(p);
  check('AC-6 G1 human moved first', g1.startedBy === 'human', g1.startedBy);
  check('AC-7 G1 thinking text + board locked + sneaky taps ignored', g1.thinkingShown && g1.lockedOnAITurn && g1.sneakBlocked, g1);
  check('AC-8/AC-10 G1 Medium falls for the fork: "You win!"', g1.final === 'You win!', g1.final + ' ' + g1.board);
  check('AC-9 G1 human win: laser + confetti', cnt1.lasers === cnt0.lasers + 1 && cnt1.confetti === cnt0.confetti + 1, { before: cnt0, after: cnt1 });
  await sleep(1500);
  check('AC-13 end row: Rematch, New Game, wheel', JSON.stringify(await endRow(p)) === JSON.stringify(['rematchBtn', 'newGameBtn', 'wheelBtn']), await endRow(p));
  await p.screenshot({ path: OUT + '/d06-end-row.png' });

  // Game 2: Rematch double-clicked -> AI first, human plays badly -> AI wins, no confetti
  const b2 = (await counters(p)).builds;
  await p.dblclick('#rematchBtn'); await sleep(500);
  check('AC-12 double-clicked Rematch builds one board', (await counters(p)).builds === b2 + 1, (await counters(p)).builds - b2);
  const cnt2 = await counters(p);
  const g2 = await playAI(p, losePolicy, 'G2 medium, AI first, human loses');
  const cnt3 = await counters(p);
  check('AC-6 G2 (Rematch) AI moved first', g2.startedBy === 'ai' && g2.lockedOnAITurn, g2.startedBy);
  check('AC-8 G2 "AI wins"', g2.final === 'AI wins', g2.final + ' ' + g2.board);
  await sleep(1500);
  const cnt3b = await counters(p);
  check('AC-9 G2 AI win: laser, NO confetti', cnt3b.lasers === cnt2.lasers + 1 && cnt3b.confetti === cnt2.confetti, { before: cnt2, after: cnt3b });
  const aiMarksAfterEnd = (await boardState(p)).filter(v => v === 'O').length;
  await sleep(1500);
  check('AC-12 no AI move after game end', (await boardState(p)).filter(v => v === 'O').length === aiMarksAfterEnd);

  // Game 3: Rematch -> human first again
  await p.click('#rematchBtn'); await sleep(500);
  const g3 = await playAI(p, forkPolicy, 'G3 medium, human first');
  check('AC-6 G3 alternates back to human first', g3.startedBy === 'human', g3.startedBy + ' -> ' + g3.final);
  await sleep(1500);

  // Game 4: New Game -> 1 Player -> Hard (double-click) -> colours kept -> straight to board; fork trap must NOT beat Hard
  await p.click('#newGameBtn'); await sleep(800);
  check('AC-2 New Game after a game -> Mode step', await vis(p, '#modeStep'));
  await p.click('#modeAiBtn'); await sleep(800);
  check('AC-5 difficulty pre-highlighted (Medium)', await p.evaluate(() => document.getElementById('diffMediumBtn').classList.contains('selected')));
  const b4 = (await counters(p)).builds;
  await p.dblclick('#diffHardBtn'); await sleep(1000);
  check('AC-3 colours chosen -> straight to board; one build', (await vis(p, '#board')) && !(await vis(p, '#picker')) && (await counters(p)).builds === b4 + 1, (await counters(p)).builds - b4);
  const g4 = await playAI(p, forkPolicy, 'G4 hard, fork trap');
  check('AC-6 G4 human first after New Game', g4.startedBy === 'human');
  check('AC-10/11 G4 Hard is wired: fork trap fails', g4.final !== 'You win!', g4.final + ' ' + g4.board);
  await sleep(1500);

  // Game 5: Rematch -> Hard opens; check opening delay
  await p.click('#rematchBtn'); await sleep(300);
  const g5 = await playAI(p, forkPolicy, 'G5 hard, AI first');
  check('AC-11 G5 Hard (AI first) not beaten', g5.startedBy === 'ai' && g5.final !== 'You win!', g5.final);
  await sleep(1500);

  // Colour wheel in vs AI: human takes the AI's colour -> AI must move
  const cBefore = await colours(p);
  await p.click('#wheelBtn'); await sleep(900);
  check('AC-15/AC-4 wheel in vs AI: one human step', (await title(p)) === 'You: pick a colour');
  const aiIdx = await p.evaluate(o => [...document.querySelectorAll('#swatches .swatch')].findIndex(s => getComputedStyle(s).backgroundColor && s.style.background && (function (hex) { const d = document.createElement('div'); d.style.color = hex; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })(o) === getComputedStyle(s).backgroundColor), cBefore.o);
  await p.locator('#swatches .swatch').nth(aiIdx).click();
  await p.click('#confirmBtn'); await sleep(1000);
  const cAfter = await colours(p);
  check('AC-4 wheel: human took AI colour -> AI colour changed, still different', cAfter.x === cBefore.o && cAfter.o !== cAfter.x, { before: cBefore, after: cAfter, aiIdx });
  const g6 = await playAI(p, forkPolicy, 'G6 after wheel');
  await sleep(1500);

  // Switch to 2 Players with colours already chosen -> straight to board, X starts
  await p.click('#newGameBtn'); await sleep(800);
  await p.click('#mode2pBtn'); await sleep(1000);
  check('AC-3/AC-14 2P after vs AI: straight to board, "Player X’s turn"', (await vis(p, '#board')) && (await status(p)) === 'Player X’s turn', await status(p));

  const d = await delays(p);
  check('AC-7 AI reply delay 400-700 ms (+30 ms tolerance)', d.replies.length > 5 && d.replies.every(x => x >= 400 && x <= 730), d.replies);
  check('AC-7 AI opening waits for the entrance (1150 + 400-700 ms)', d.openings.length >= 2 && d.openings.every(x => x >= 1500 && x <= 1900), d.openings);
  results.push({ id: 'info: games', ok: true, detail: [g1, g2, g3, g4, g5, g6].map(g => g.label + ': ' + g.startedBy + ' first -> ' + g.final + ' [' + g.board + ']') });

  /* ===== Fresh page: 2 Players regression ===== */
  p = await newPage(desk, 'desktop-2p');
  await p.click('#newGameBtn'); await sleep(800);
  await p.click('#mode2pBtn'); await sleep(800);
  check('AC-14 2P picker step X', (await title(p)) === 'Player X — pick a colour', await title(p));
  await p.locator('#swatches .swatch').nth(0).click();
  await p.dblclick('#confirmBtn'); await sleep(800);
  check('AC-14 2P picker step O, X colour disabled', (await title(p)) === 'Player O — pick a colour' && await p.evaluate(() => document.querySelectorAll('#swatches .swatch')[0].disabled), await title(p));
  await p.locator('#swatches .swatch').nth(2).click();
  await p.click('#confirmBtn'); await sleep(1000);
  check('AC-14 2P: one board, X starts', (await counters(p)).builds === 1 && (await status(p)) === 'Player X’s turn', await status(p));
  const k0 = await counters(p);
  for (const i of [0, 3, 1, 4, 2]) { await p.locator('#board .cell').nth(i).click(); await sleep(60); }
  check('AC-14 2P win text', (await status(p)) === 'Player X wins!', await status(p));
  await sleep(1500);
  const k1 = await counters(p);
  check('AC-9/AC-14 2P win: laser + confetti', k1.lasers === k0.lasers + 1 && k1.confetti === k0.confetti + 1, { k0, k1 });
  await p.click('#rematchBtn'); await sleep(900);
  check('AC-14 2P Rematch: X starts again, no picker', (await status(p)) === 'Player X’s turn' && !(await vis(p, '#picker')));
  for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) { await p.locator('#board .cell').nth(i).click(); await sleep(60); }
  check('AC-14 2P draw text', (await status(p)) === 'It’s a draw', await status(p));

  /* ===== Phone: 375 x 812, touch ===== */
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p = await newPage(phone, 'phone');
  await p.screenshot({ path: OUT + '/m01-first-load.png' });
  await p.tap('#newGameBtn'); await sleep(800);
  await p.screenshot({ path: OUT + '/m02-mode.png' });
  await p.tap('#modeAiBtn'); await sleep(800);
  await p.screenshot({ path: OUT + '/m03-difficulty.png' });
  await p.tap('#diffMediumBtn'); await sleep(800);
  await p.screenshot({ path: OUT + '/m04-picker.png' });
  await p.locator('#swatches .swatch').nth(3).tap();
  await p.tap('#confirmBtn'); await sleep(1400);
  await p.locator('#board .cell').nth(0).tap(); await sleep(900);
  await p.screenshot({ path: OUT + '/m05-board-midgame.png' });
  const gm = await playAI(p, forkPolicy, 'phone medium');
  await sleep(1600);
  await p.screenshot({ path: OUT + '/m06-end.png' });
  const mc = await counters(p);
  check('AC-15 phone: page never wider than 375 px', mc.maxW <= 375, mc.maxW);
  results.push({ id: 'info: phone game', ok: true, detail: gm.final + ' [' + gm.board + ']' });

  check('AC-15 no console errors/warnings (all runs)', errors.length === 0, errors);
  await browser.close();

  const fails = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + (r.detail !== '' ? '  ::  ' + JSON.stringify(r.detail) : ''));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
