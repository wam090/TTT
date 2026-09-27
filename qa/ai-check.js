// Dev Manager QA for T-001: independent, exhaustive check of window.TTT.chooseAIMove.
// Uses its own reference rules and minimax (not the developer's code).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.resolve(process.argv[2]));

  const result = await page.evaluate(() => {
    const choose = window.TTT && window.TTT.chooseAIMove;
    if (typeof choose !== 'function') return { fatal: 'window.TTT.chooseAIMove missing' };
    const keys = Object.keys(window.TTT);

    const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const other = m => (m === 'X' ? 'O' : 'X');
    const winner = b => { for (const [a, c, d] of L) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; return null; };
    const empties = b => { const r = []; for (let i = 0; i < 9; i++) if (!b[i]) r.push(i); return r; };
    const winsFor = (b, m) => empties(b).filter(i => { const c = b.slice(); c[i] = m; return winner(c) === m; });

    // Reference depth-scored minimax exactly as the spec defines it (memoised, no pruning)
    const memo = new Map();
    function score(b, toMove, ai, depth) {
      const w = winner(b);
      if (w) return w === ai ? 10 - depth : depth - 10;
      const e = empties(b);
      if (!e.length) return 0;
      const key = b.map(v => v || '-').join('') + toMove + ai + depth;
      if (memo.has(key)) return memo.get(key);
      let best = toMove === ai ? -Infinity : Infinity;
      for (const i of e) {
        b[i] = toMove;
        const s = score(b, other(toMove), ai, depth + 1);
        b[i] = '';
        best = toMove === ai ? Math.max(best, s) : Math.min(best, s);
      }
      memo.set(key, best);
      return best;
    }
    function bestSet(b, ai) {
      let best = -Infinity, set = [];
      for (const i of empties(b)) {
        b[i] = ai;
        const s = score(b, other(ai), ai, 1);
        b[i] = '';
        if (s > best) { best = s; set = [i]; } else if (s === best) set.push(i);
      }
      return set.sort((p, q) => p - q);
    }

    // Every board with no winner and at least one empty cell
    const positions = [];
    for (let n = 0; n < 19683; n++) {
      const b = []; let x = n;
      for (let i = 0; i < 9; i++) { b.push(['', 'X', 'O'][x % 3]); x = Math.floor(x / 3); }
      if (!winner(b) && empties(b).length) positions.push(b);
    }

    const realRandom = Math.random;
    const fails = [];
    function call(b, ai, lvl, rng) {
      const before = b.join(',');
      Math.random = () => { throw new Error('Math.random used'); };
      let r;
      try { r = choose(b, ai, lvl, rng); }
      catch (e) { fails.push({ why: 'threw: ' + e.message, b: before, ai, lvl }); r = -1; }
      finally { Math.random = realRandom; }
      if (b.join(',') !== before) fails.push({ why: 'mutated input board', b: before, ai, lvl });
      if (!Number.isInteger(r) || r < 0 || r > 8 || b[r]) fails.push({ why: 'illegal move ' + r, b: before, ai, lvl });
      return r;
    }

    const stats = {};
    for (const ai of ['X', 'O']) {
      const hu = other(ai);
      // Legal for the AI to move: equal counts (AI started) or one fewer (human started)
      const legal = positions.filter(b => {
        const a = b.filter(v => v === ai).length, h = b.filter(v => v === hu).length;
        return a === h || a === h - 1;
      });
      stats['positions_ai_' + ai] = legal.length;
      for (const b of legal) {
        const e = empties(b), aiW = winsFor(b, ai), huW = winsFor(b, hu);
        for (const lvl of ['easy', 'medium', 'hard']) {
          const n = lvl === 'hard' ? 36 : 72;
          const counts = new Map();
          for (let k = 0; k < n; k++) {
            const r = call(b, ai, lvl, () => (k + 0.5) / n);
            counts.set(r, (counts.get(r) || 0) + 1);
          }
          const got = [...counts.keys()].sort((p, q) => p - q);
          let expect = null;
          if ((lvl === 'easy' || lvl === 'medium') && aiW.length) {
            if (!got.every(r => aiW.includes(r))) fails.push({ why: lvl + ': missed own win', b: b.join(','), ai, got, aiW });
          } else if (lvl === 'medium' && huW.length) {
            if (!got.every(r => huW.includes(r))) fails.push({ why: 'medium: missed block', b: b.join(','), ai, got, huW });
          } else {
            if (lvl === 'easy') expect = e;
            else if (lvl === 'medium') {
              if (!b[4]) expect = [4];
              else {
                const c = [0, 2, 6, 8].filter(i => !b[i]);
                expect = c.length ? c : [1, 3, 5, 7].filter(i => !b[i]);
              }
            } else expect = bestSet(b.slice(), ai);
            if (JSON.stringify(got) !== JSON.stringify(expect)) fails.push({ why: lvl + ': wrong move set', b: b.join(','), ai, got, expect });
            if (lvl !== 'hard' && expect.length > 1) {
              const cs = expect.map(i => counts.get(i) || 0);
              if (Math.max(...cs) - Math.min(...cs) > 1) fails.push({ why: lvl + ': not uniform', b: b.join(','), ai, cs });
            }
          }
          stats[lvl + '_positions_checked'] = (stats[lvl + '_positions_checked'] || 0) + 1;
        }
      }
    }

    // Full game trees vs Hard: every human move x every move Hard can choose (all ties)
    const choiceMemo = new Map();
    function aiChoices(b, ai) {
      const key = b.join(',') + ai;
      if (choiceMemo.has(key)) return choiceMemo.get(key);
      const s = new Set();
      for (let k = 0; k < 36; k++) s.add(call(b, ai, 'hard', () => (k + 0.5) / 36));
      const r = [...s];
      choiceMemo.set(key, r);
      return r;
    }
    let games, humanWins, aiWins, draws;
    function play(b, toMove, ai) {
      const w = winner(b);
      if (w) { games++; if (w === ai) aiWins++; else humanWins++; return; }
      const e = empties(b);
      if (!e.length) { games++; draws++; return; }
      const moves = toMove === ai ? aiChoices(b, ai) : e;
      for (const i of moves) { b[i] = toMove; play(b, other(toMove), ai); b[i] = ''; }
    }
    const tree = {};
    for (const ai of ['O', 'X']) for (const first of ['human', 'ai']) {
      games = humanWins = aiWins = draws = 0;
      play(Array(9).fill(''), first === 'ai' ? ai : other(ai), ai);
      tree['ai=' + ai + ', first=' + first] = { games, humanWins, aiWins, draws };
    }

    // Speed
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) choose(Array(9).fill(''), 'O', 'hard', () => 0.5);
    const emptyBoardMs = +((performance.now() - t0) / 20).toFixed(2);
    let worstMs = 0;
    for (const b of positions) { const t = performance.now(); choose(b, 'O', 'hard', () => 0.5); worstMs = Math.max(worstMs, performance.now() - t); }

    return { keys, stats, failCount: fails.length, fails: fails.slice(0, 8), tree, emptyBoardMs, worstMs: +worstMs.toFixed(2) };
  });

  console.log(JSON.stringify(result, null, 1));
  console.log('console/page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
