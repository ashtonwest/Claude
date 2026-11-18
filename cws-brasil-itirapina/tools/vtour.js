const { chromium } = require('playwright');
const URL0 = process.argv[2], OUT = process.argv[3], ONLY = process.argv[4];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
let CASES = [
  { name: 'laptop', ctx: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 } },
  { name: 'phone', touch: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA } },
  { name: 'landscape', touch: true, ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA } },
];
if (ONLY) CASES = CASES.filter(c => c.name === ONLY);
const wrap = a => ((a + 540) % 360) - 180;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = {};
  for (const c of CASES) {
    const R = report[c.name] = { fails: [] }; const fail = m => R.fails.push(m);
    const ctx = await b.newContext(c.ctx); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const st = () => p.evaluate(() => window.__tour.s);
    const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await st(); if (fn(s)) return s; await sleep(60); } fail('timeout: ' + what); return st(); };
    const cdp = await ctx.newCDPSession(p);
    const box = async () => p.locator('#stage').boundingBox();
    const dragBy = async (dx, dy) => { const B = await box(); const x = B.x + B.width / 2, y = B.y + B.height * 0.45;
      if (c.touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / 8, y: y + dy * k / 8 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      else { await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx, y + dy, { steps: 8 }); await p.mouse.up(); } };
    const tapAt = async (x, y) => { const B = await box(); if (c.touch) await p.touchscreen.tap(B.x + x, B.y + y); else await p.mouse.click(B.x + x, B.y + y); };
    await p.goto(URL0); let s = await until(s => s.ready, 20000, 'first load');
    const meta = await p.evaluate(() => ({ n: __tour.T.nodes.length, vp: document.querySelector('meta[name=viewport]')?.content, iw: innerWidth, src: document.getElementById('vid').src.slice(0, 5), proto: location.protocol,
      legs: __tour.T.nodes.map((n, i, a) => !!(a[i + 1] && !a[i + 1].cut && ((a[i + 1].clip === n.clip && a[i + 1].t > n.t) || a[i + 1].cont))), ids: __tour.T.nodes.map(n => n.id), ts: __tour.T.nodes.map(n => n.t), names: __tour.T.nodes.map(n => n.name) }));
    Object.assign(R, { stops: meta.n, viewport: meta.vp, layoutWidth: meta.iw, protocol: meta.proto, videoSrc: meta.src, gl: s.gl });
    if (meta.iw !== c.ctx.viewport.width) fail('layout width'); if (!s.gl) fail('no webgl');
    await sleep(300); s = await st(); R.outlinesAtStart = s.drawn.length; await p.screenshot({ path: `${OUT}/${c.name}-0-start.png` });
    // --- first leg: travel, pause mid-leg, look a full turn, resume
    const firstLeg = meta.legs.indexOf(true);
    if (firstLeg !== 0) fail('route does not start with a filmed leg');
    const t0 = s.t; await p.click('#go'); await sleep(1500); s = await st();
    if (!(s.t > t0 + 0.8) || s.paused) fail('did not travel: ' + s.t); R.travelAdvance1500ms = +(s.t - t0).toFixed(2);
    const shotA = await p.screenshot({ path: `${OUT}/${c.name}-1-moving.png` });
    await p.click('#go'); await sleep(150); const p1 = await st(); await sleep(1200); const p2 = await st();
    if (!p1.paused || p1.leg === null) fail('not paused mid-leg'); if (p2.t !== p1.t) fail('time moved while paused: ' + p1.t + ' -> ' + p2.t);
    R.pausedAtClipSeconds = p1.t; R.timeDriftWhilePaused = p2.t - p1.t;
    let turned = 0, last = p2.lon; const step = Math.round((await box()).width * 0.42);
    for (let k = 0; k < 14 && Math.abs(turned) < 380; k++) { await dragBy(-step, 0); const q = await st(); turned += wrap(q.lon - last); last = q.lon; }
    R.fullTurnDegrees = Math.round(Math.abs(turned)); if (Math.abs(turned) < 360) fail('could not turn a full circle: ' + turned);
    await dragBy(Math.round(step * 0.6), 30); const l1 = await st(); await sleep(1000); const l2 = await st();
    if (Math.abs(wrap(l2.lon - l1.lon)) > 0.01 || Math.abs(l2.pitch - l1.pitch) > 0.01) fail('view was pulled after the drag'); if (l2.t !== p1.t) fail('time changed during look-around');
    R.viewHeldAfterDrag = true; await p.screenshot({ path: `${OUT}/${c.name}-2-paused-looking.png` });
    await p.click('#go'); await sleep(350); const r1 = await st();
    if (r1.paused) fail('did not resume'); if (!(r1.t >= p1.t && r1.t - p1.t < 0.9)) fail('resume jumped: ' + p1.t + ' -> ' + r1.t); R.resumeFrom = p1.t; R.resumeFirstSample = r1.t;
    if (r1.follow !== 0) fail('resume pulled the view back to the route direction');
    s = await until(s => s.leg === null && s.paused, 40000, 'arrival 1'); R.arrivalError = [+(s.t - meta.ts[1]).toFixed(3)];
    if (s.ni !== 1) fail('arrived at wrong stop');
    // --- walk the whole default route
    const tapSizes = []; R.overlap = 'none found'; R.tapSelects = 0;
    for (let k = 1; k < meta.n; k++) {
      s = await st(); if (s.ni !== k) fail(`expected stop ${k} got ${s.ni}`);
      await sleep(1400); s = await st();
      { const B1 = await box(); R.labelsChecked = (R.labelsChecked || 0) + s.drawn.length;
        for (const d of s.drawn) { if (!d.label) continue; if (d.label[0] - d.label[2] < -1 || d.label[0] + d.label[2] > B1.width + 1 || d.label[1] < 40 || d.label[1] > B1.height) fail(`label off screen at stop ${k + 1}: ${d.key}`);
          if (s.arrow && Math.abs(d.label[0] - s.arrow[0]) < d.label[2] + 30 && d.label[1] > s.arrow[1] - 40 && d.label[1] < s.arrow[1] + 62) fail(`label on the arrow at stop ${k + 1}: ${d.key}`); }
        if (meta.ids[k] === 'mezanino') { R.mezaninoArrival = s.drawn.map(d => d.key).join(','); if (!s.drawn.some(d => d.key === 'guardacorpo')) fail('guardrail not in view on fresh arrival at the top of the stairs'); await p.screenshot({ path: `${OUT}/${c.name}-mezanino.png` }); }
        if (['plen-mesas', 'corredor-cima', 'rampa', 'caixa', 'hall-poltronas', 'sala-cima'].includes(meta.ids[k])) await p.screenshot({ path: `${OUT}/${c.name}-${meta.ids[k]}.png` });
        if (!s.drawn.length && !s.cue) fail('no outlines and no cue at stop ' + (k + 1)); }
      // tap every outline on screen at this stop; where two overlap, the smaller must win
      const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const B0 = await box(); const okPt = q => q[0] > 20 && q[1] > 75 && q[0] < B0.width - 20 && q[1] < B0.height - 20 && !(s.arrow && Math.hypot(q[0] - s.arrow[0], q[1] - s.arrow[1]) < 55);
      for (const small of s.drawn) for (const big of s.drawn) {   // a point that lies inside two outlines: the smaller one must be selected
        if (small === big || small.key === big.key || small.area >= big.area || R.overlap !== 'none found') continue;
        const cx = small.pts.reduce((a, q) => a + q[0], 0) / small.pts.length, cy = small.pts.reduce((a, q) => a + q[1], 0) / small.pts.length;
        if (!inPoly(cx, cy, small.pts) || !inPoly(cx, cy, big.pts) || !okPt([cx, cy])) continue;
        await tapAt(cx, cy); const q = await st(); await p.evaluate(() => document.getElementById('sClose').click());
        if (q.sel === small.key) R.overlap = `stop ${k + 1}: point inside "${big.key}" and "${small.key}" selected the smaller, "${small.key}"`; else fail(`overlap at stop ${k + 1} selected ${q.sel}, expected ${small.key}`);
      }
      for (const d of s.drawn.slice(0, 6)) { if (!okPt(d.c)) continue;
        const B = await box(); if (d.c[0] < 20 || d.c[1] < 70 || d.c[0] > B.width - 20 || d.c[1] > B.height - 20) continue;
        await tapAt(d.c[0], d.c[1]); const q = await st(); if (q.sel) R.tapSelects++;
        const inside = await p.evaluate(([x, y]) => { const s = window.__tour.s; return s.sel; }, d.c);
        const text = await p.evaluate(() => document.getElementById('sheet').hidden ? '' : document.getElementById('sDo').textContent + ' | ' + document.getElementById('sLimit').textContent);
        if (q.sel && !text) fail('sheet empty for ' + q.sel);
        if (q.sel && q.sel !== d.key) { const smaller = q.drawn.find(x => x.key === q.sel); if (smaller && smaller.area <= d.area) R.overlap = `tap inside ${d.key} and ${q.sel}: selected the smaller (${q.sel})`; else fail('overlap picked the larger outline'); }
        if (k === 5 && q.sel) await p.screenshot({ path: `${OUT}/${c.name}-3-tapped.png` });
        await p.evaluate(() => document.getElementById('sClose').click());
      }
      tapSizes.push(...await p.evaluate(() => ['go', 'back', 'routeBtn', 'scopeBtn'].map(id => Math.min(...[document.getElementById(id).getBoundingClientRect()].map(b => Math.min(b.width, b.height))))));
      const bad = await p.evaluate(() => { const v = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.left >= -1; }; return ['go', 'back'].filter(id => !v(document.getElementById(id))).join(',') + (document.documentElement.scrollWidth > innerWidth ? ' hscroll' : ''); });
      if (bad) fail('layout at stop ' + k + ': ' + bad);
      if (k === meta.n - 1) break;
      const tBefore = s.t; await p.click('#go');
      if (meta.legs[k]) { await sleep(1200); const m = await st(); if (m.paused || m.leg === null) fail('leg ' + k + ' did not move'); if (meta.ids[k] === 'porta-lateral') { await sleep(9000); await p.click('#go'); await sleep(500); const g = await st(); R.cueInGap = g.cue || (g.drawn.length ? 'outlines present' : ''); if (!g.drawn.length && !g.cue) fail('no cue in an unmarked stretch'); await p.screenshot({ path: `${OUT}/${c.name}-gap-cue.png` }); await p.click('#go'); } s = await until(s => s.leg === null && s.paused && s.ni === k + 1, 60000, 'arrival ' + (k + 1)); R.arrivalError.push(+(s.t - meta.ts[k + 1]).toFixed(3)); }
      else { const j = await p.evaluate(() => !document.getElementById('jump').hidden && document.getElementById('jumpNote').textContent); if (!j) fail('no location-change card before stop ' + (k + 1)); R.gapCard = j; s = await until(s => s.ni === k + 1 && s.ready && s.leg === null, 30000, 'jump ' + (k + 1)); }
    }
    if (!(await p.evaluate(() => document.getElementById('go').disabled))) fail('go not disabled at the end');
    await p.screenshot({ path: `${OUT}/${c.name}-4-last.png` });
    // --- return to a location from the route list, and the scope list
    await p.click('#routeBtn'); await sleep(150); await p.screenshot({ path: `${OUT}/${c.name}-5-route.png` });
    await p.click('#routeList [data-node="0"]'); s = await until(s => s.ni === 0 && s.ready && s.clipId === 'B', 20000, 'return to first stop'); await sleep(300); s = await st(); if (Math.abs(s.t - meta.ts[0]) > 0.05) fail('return seek off');
    await p.click('#scopeBtn'); await sleep(150); R.scopeRows = await p.evaluate(() => document.querySelectorAll('#scopeList li').length); await p.screenshot({ path: `${OUT}/${c.name}-6-scope.png` }); await p.click('#scopeBtn');
    await p.click('#go'); await sleep(900); await p.click('#back'); s = await until(s => s.leg === null && s.ready && s.paused, 10000, 'back mid-leg'); if (s.ni !== 0) fail('back mid-leg wrong stop');
    R.minTapTarget = Math.round(Math.min(...tapSizes)); if (R.minTapTarget < 44) fail('tap target under 44');
    R.pageErrors = errs; if (errs.length) fail('page errors'); await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1)); await b.close();
})();
