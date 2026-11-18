/* محرك ألغاز «الهروب من قلعة الدوال»
 * يُستخدم في المتصفح وفي الخادم معًا: الخادم يعيد توليد اللغز من البذرة نفسها ويصحّح الإجابة بنفسه.
 * كل لغز يُولَّد من بذرة الطالبة، فلكل طالبة أرقامها الخاصة.
 */
(function (root) {
  'use strict';

  // ---------- أدوات عشوائية ثابتة ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeRng(seed, salt) {
    let a = hashStr(String(seed) + '|' + salt);
    const next = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    return next;
  }

  // ---------- تنسيق رياضي ----------
  const MINUS = '−';
  function n(v) { return v < 0 ? MINUS + Math.abs(v) : String(v); }
  function coef(a, v) { if (a === 1) return v; if (a === -1) return MINUS + v; return n(a) + v; }
  function plus(b) { if (b === 0) return ''; return b > 0 ? ' + ' + b : ' ' + MINUS + ' ' + Math.abs(b); }
  function lin(a, b, v) { v = v || 'x'; if (a === 0) return n(b); return coef(a, v) + plus(b); }
  function frac(num, den) { return '<span class="frac"><span>' + num + '</span><span>' + den + '</span></span>'; }
  function M(s) { return '<span class="m" dir="ltr">' + s + '</span>'; }
  const SQ = '<sup>2</sup>', CU = '<sup>3</sup>', INV = 'f<sup>' + MINUS + '1</sup>';
  function cbrt(inner) { return '<span class="rad">∛<span class="radin">' + inner + '</span></span>'; }

  const PUZZLES = ['r1_ops', 'r1_comp', 'r2_points', 'r2_line', 'r3_m1', 'r3_m2', 'r3_m3', 'r4_match', 'r5_wires', 'r5_key', 'r5_final'];
  const ROOM_OF = { r1_ops: 1, r1_comp: 1, r2_points: 2, r2_line: 2, r3_m1: 3, r3_m2: 3, r3_m3: 3, r4_match: 4, r5_wires: 5, r5_key: 5, r5_final: 5 };
  const BOMB = ['r5_wires', 'r5_key', 'r5_final'];
  const ROOMS = [
    { id: 1, name: 'بوابة الشفرات', icon: '🔐', skill: 'العمليات على الدوال وتركيبها' },
    { id: 2, name: 'قاعة المرايا العكسية', icon: '🪞', skill: 'العلاقات العكسية والانعكاس حول y = x' },
    { id: 3, name: 'مختبر الخيميائي', icon: '⚗️', skill: 'تركيب الدوال وتفكيكها' },
    { id: 4, name: 'سرداب الأرواح المتطابقة', icon: '🔮', skill: 'إيجاد الدالة العكسية والتحقق منها' },
    { id: 5, name: 'خزانة الكنز', icon: '💣', skill: 'اختبار الخط الأفقي وقيم الدالة العكسية' }
  ];
  const TITLES = {
    r1_ops: 'قفل العمليات', r1_comp: 'قفل التركيب', r2_points: 'جواهر المرآة', r2_line: 'شعاع المرآة',
    r3_m1: 'الآلة الأولى', r3_m2: 'الآلة الثانية', r3_m3: 'الآلة الكبرى', r4_match: 'دائرة الأرواح',
    r5_wires: 'أسلاك الخط الأفقي', r5_key: 'لوحة المعكوس', r5_final: 'الصمام الأخير'
  };

  // ---------- المولّدات ----------
  const GEN = {};

  // الغرفة 1-أ: العمليات على الدوال (قفل من 4 أرقام)
  GEN.r1_ops = function (R) {
    for (let t = 0; t < 500; t++) {
      const a = R.pick([2, 3]), b = R.int(-4, 5), c = R.pick([-3, -2, -1, 1, 2, 3]);
      const f = x => a * x + b, g = x => x + c;
      const ops = [
        { sym: '+', ev: x => f(x) + g(x) },
        { sym: MINUS, ev: x => f(x) - g(x) },
        { sym: '·', ev: x => f(x) * g(x) },
        { sym: '/', ev: x => (g(x) === 0 ? NaN : f(x) / g(x)) }
      ];
      const picks = [];
      let ok = true;
      for (const op of ops) {
        const xs = [];
        for (let x = -4; x <= 5; x++) { const v = op.ev(x); if (Number.isInteger(v) && v >= 0 && v <= 9) xs.push(x); }
        if (!xs.length) { ok = false; break; }
        const x = R.pick(xs);
        picks.push({ sym: op.sym, x, val: op.ev(x), fx: f(x), gx: g(x) });
      }
      if (!ok) continue;
      const digits = picks.map(p => p.val);
      if (new Set(digits).size < 3) continue;
      return { a, b, c, f: lin(a, b), g: lin(1, c), clues: picks, answer: digits };
    }
    throw new Error('r1_ops gen failed');
  };

  // الغرفة 1-ب: تركيب الدوال (قفل من 3 أرقام)
  GEN.r1_comp = function (R) {
    for (let t = 0; t < 500; t++) {
      const b = R.int(-4, 3), m = R.pick([1, 2]), c = R.pick([-3, -2, -1, 1, 2, 3]);
      const f = x => x * x + b, g = x => m * x + c;
      const defs = [
        { label: '(f ∘ g)', ev: x => f(g(x)), inner: 'g', innerEv: g },
        { label: '(g ∘ f)', ev: x => g(f(x)), inner: 'f', innerEv: f },
        { label: '(g ∘ g)', ev: x => g(g(x)), inner: 'g', innerEv: g }
      ];
      const picks = []; let ok = true;
      for (const d of defs) {
        const xs = [];
        for (let x = -4; x <= 4; x++) { const v = d.ev(x); if (v >= 0 && v <= 9) xs.push(x); }
        if (!xs.length) { ok = false; break; }
        const x = R.pick(xs);
        picks.push({ label: d.label, x, val: d.ev(x), inner: d.inner, innerVal: d.innerEv(x) });
      }
      if (!ok) continue;
      // نتجنب حالة يكون فيها (f∘g)(x) = (g∘f)(x) حتى لا يُكافأ الخلط بين الترتيبين
      if (f(g(picks[0].x)) === g(f(picks[0].x))) continue;
      if (f(g(picks[1].x)) === g(f(picks[1].x))) continue;
      return { b, m, c, f: 'x' + SQ + plus(b), g: lin(m, c), clues: picks, answer: picks.map(p => p.val) };
    }
    throw new Error('r1_comp gen failed');
  };

  // الغرفة 2-أ: معكوس علاقة (نقاط)
  GEN.r2_points = function (R) {
    for (let t = 0; t < 500; t++) {
      const pts = [];
      const seen = new Set();
      while (pts.length < 4) {
        const x = R.int(-4, 4), y = R.int(-4, 4);
        if (x === y) continue;
        const k = x + ',' + y; if (seen.has(k)) continue;
        seen.add(k); pts.push([x, y]);
      }
      const inv = pts.map(([x, y]) => [y, x]);
      // لا تتطابق نقطة من المعكوس مع نقطة من الأصل حتى تكون المهمة واضحة
      if (inv.some(([x, y]) => seen.has(x + ',' + y))) continue;
      return { points: pts, answer: inv };
    }
    throw new Error('r2_points gen failed');
  };

  // الغرفة 2-ب: رسم الدالة العكسية لدالة خطية
  GEN.r2_line = function (R) {
    for (let t = 0; t < 500; t++) {
      const m = R.pick([2, -2, 3, -3]), k = R.int(-3, 3);
      const invPts = [];
      for (let y = -6; y <= 6; y++) { const x = m * y + k; if (x >= -6 && x <= 6) invPts.push([x, y]); }
      if (invPts.length < 3) continue;
      const fPts = invPts.map(([x, y]) => [y, x]);
      return { m, k, f: lin(m, k), fPts, answer: invPts };
    }
    throw new Error('r2_line gen failed');
  };

  // الغرفة 3: آلات التركيب
  function machineTiles(R) {
    const a = R.int(1, 4), b = R.pick([2, 3]);
    let d = R.int(1, 3); if (d === a) d = (d % 3) + 1;
    return {
      a, b, d,
      tiles: [
        { id: 'A', label: 'x + ' + a, ev: null },
        { id: 'B', label: b + 'x', ev: null },
        { id: 'C', label: 'x' + SQ, ev: null },
        { id: 'D', label: 'x ' + MINUS + ' ' + d, ev: null }
      ]
    };
  }
  function tileFn(t, id) {
    if (id === 'A') return x => x + t.a;
    if (id === 'B') return x => t.b * x;
    if (id === 'C') return x => x * x;
    if (id === 'D') return x => x - t.d;
    return x => NaN;
  }
  function machineEval(t, seq, x) { let v = x; for (const id of seq) v = tileFn(t, id)(v); return v; }
  GEN.r3_m1 = function (R) {
    const t = machineTiles(R);
    return Object.assign(t, { slots: 2, target: lin(t.b, t.a * t.b, 'x'), answer: ['A', 'B'] });
  };
  GEN.r3_m2 = function (R) {
    const t = machineTiles(R);
    return Object.assign(t, { slots: 2, target: 'x' + SQ + plus(t.a), answer: ['C', 'A'] });
  };
  GEN.r3_m3 = function (R) {
    const t = machineTiles(R);
    const A2 = t.b * t.b, B1 = 2 * t.a * t.b, C0 = t.a * t.a;
    return Object.assign(t, { slots: 3, target: A2 + 'x' + SQ + ' + ' + B1 + 'x + ' + C0, answer: ['B', 'A', 'C'] });
  };

  // الغرفة 4: مطابقة الدالة بدالتها العكسية
  GEN.r4_match = function (R) {
    for (let tr = 0; tr < 500; tr++) {
      const a1 = R.pick([2, 3, 4, 5]), b1 = R.pick([-7, -5, -3, -1, 1, 3, 5, 7]);
      const a2 = R.pick([2, 3, 4]), b2 = R.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
      const k3 = R.int(2, 9);
      const c4 = R.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
      const c5 = R.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
      if (c5 === c4 || c5 === -c4) continue;
      const cb = x => Math.cbrt(x);
      const fs = [
        { tex: lin(a1, b1), ev: x => a1 * x + b1 },
        { tex: frac('x', a2) + plus(b2), ev: x => x / a2 + b2 },
        { tex: k3 + ' ' + MINUS + ' x', ev: x => k3 - x },
        { tex: 'x' + CU + plus(c4), ev: x => x * x * x + c4 },
        { tex: '(' + lin(1, -c5) + ')' + CU, ev: x => Math.pow(x - c5, 3) }
      ];
      const invs = [
        { tex: frac(lin(1, -b1), a1), ev: x => (x - b1) / a1 },
        { tex: lin(a2, -a2 * b2), ev: x => a2 * x - a2 * b2 },
        { tex: k3 + ' ' + MINUS + ' x', ev: x => k3 - x },
        { tex: cbrt(lin(1, -c4)), ev: x => cb(x - c4) },
        { tex: cbrt('x') + plus(c5), ev: x => cb(x) + c5 }
      ];
      const decoys = [
        { tex: frac(lin(1, b1), a1), ev: x => (x + b1) / a1 },
        { tex: cbrt('x') + plus(-c4), ev: x => cb(x) - c4 }
      ];
      const all = invs.map((v, i) => Object.assign({ key: 'i' + i }, v)).concat(decoys.map((v, i) => Object.assign({ key: 'd' + i }, v)));
      const cands = R.shuffle(all);
      const order = R.shuffle([0, 1, 2, 3, 4]);
      const funcs = order.map(i => Object.assign({ key: 'f' + i }, fs[i]));
      const answer = {};
      funcs.forEach(fn => { answer[fn.key] = cands.findIndex(c => c.key === 'i' + fn.key.slice(1)); });
      return { funcs, cands, answer, params: { a1, b1, a2, b2, k3, c4, c5 } };
    }
    throw new Error('r4 gen failed');
  };
  function isInversePair(f, g) {
    const ts = [-3, -1.5, -0.5, 0.7, 2, 4.5];
    return ts.every(t => { const v1 = f(g(t)), v2 = g(f(t)); return Math.abs(v1 - t) < 1e-6 && Math.abs(v2 - t) < 1e-6; });
  }

  // الغرفة 5-أ: أسلاك اختبار الخط الأفقي
  const GRAPH_POOL = {
    inj: [
      { tex: '2x + 1', ev: x => 2 * x + 1 },
      { tex: frac('x' + CU, '8'), ev: x => x * x * x / 8 },
      { tex: '√(x + 4)', ev: x => (x >= -4 ? Math.sqrt(x + 4) : NaN) },
      { tex: MINUS + frac('x', '2') + ' + 1', ev: x => -x / 2 + 1 },
      { tex: frac('x' + CU, '10') + ' + x', ev: x => x * x * x / 10 + x },
      { tex: '3 ' + MINUS + ' x', ev: x => 3 - x }
    ],
    non: [
      { tex: frac('x' + SQ, '2') + ' ' + MINUS + ' 2', ev: x => x * x / 2 - 2 },
      { tex: '|x| ' + MINUS + ' 1', ev: x => Math.abs(x) - 1 },
      { tex: frac('x' + CU, '4') + ' ' + MINUS + ' 2x', ev: x => x * x * x / 4 - 2 * x },
      { tex: MINUS + frac('x' + SQ, '3') + ' + 3', ev: x => -x * x / 3 + 3 },
      { tex: '|x + 1| ' + MINUS + ' 2', ev: x => Math.abs(x + 1) - 2 },
      { tex: frac('(x ' + MINUS + ' 1)' + SQ, '2') + ' ' + MINUS + ' 3', ev: x => (x - 1) * (x - 1) / 2 - 3 }
    ]
  };
  GEN.r5_wires = function (R) {
    const nNon = R.pick([2, 3]);
    const inj = R.shuffle(GRAPH_POOL.inj.map((g, i) => ({ pool: 'inj', i }))).slice(0, 5 - nNon);
    const non = R.shuffle(GRAPH_POOL.non.map((g, i) => ({ pool: 'non', i }))).slice(0, nNon);
    const wires = R.shuffle(inj.concat(non));
    const colors = R.shuffle(['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7']);
    wires.forEach((w, i) => { w.color = colors[i]; const g = GRAPH_POOL[w.pool][w.i]; w.tex = g.tex; });
    const answer = wires.map((w, i) => (w.pool === 'non' ? i : -1)).filter(i => i >= 0);
    return { wires, answer };
  };
  function wireFn(w) { return GRAPH_POOL[w.pool][w.i].ev; }

  // الغرفة 5-ب: قيمة الدالة العكسية
  GEN.r5_key = function (R) {
    if (R() < 0.6) {
      const a = R.pick([2, 3, 4, 5, -2, -3]), b = R.int(-9, 9), t = R.int(-6, 9);
      return { kind: 'lin', a, b, f: lin(a, b), v: a * t + b, answer: t };
    }
    const c = R.int(-9, 9), t = R.pick([-3, -2, -1, 0, 1, 2, 3]);
    return { kind: 'cube', c, f: 'x' + CU + plus(c), v: t * t * t + c, answer: t };
  };

  // الغرفة 5-ج: تركيب مع الدالة العكسية
  GEN.r5_final = function (R) {
    for (let tr = 0; tr < 500; tr++) {
      const a = R.pick([2, 3, 4]), b = R.int(-8, 8), c = R.int(-3, 3);
      const g = x => x * x + c;
      const ps = [];
      for (let p = -4; p <= 4; p++) { const v = (g(p) - b) / a; if (Number.isInteger(v) && Math.abs(v) <= 20) ps.push(p); }
      if (!ps.length) continue;
      const p = R.pick(ps);
      return { a, b, c, f: lin(a, b), g: 'x' + SQ + plus(c), p, gp: g(p), answer: (g(p) - b) / a };
    }
    throw new Error('r5_final gen failed');
  };

  function generate(id, seed, variant) {
    const salt = id + (BOMB.includes(id) ? '#' + (variant || 0) : '');
    const R = makeRng(seed, salt);
    const d = GEN[id](R);
    d.id = id; d.variant = BOMB.includes(id) ? (variant || 0) : 0;
    return d;
  }

  // ---------- التصحيح ----------
  function sameSet(a, b) {
    const A = new Set(a.map(p => p.join(','))), B = new Set(b.map(p => p.join(',')));
    if (A.size !== B.size) return false;
    for (const k of A) if (!B.has(k)) return false;
    return true;
  }
  function isInt(v) { return typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v; }

  function check(id, seed, variant, ans) {
    const d = generate(id, seed, variant);
    try {
      switch (id) {
        case 'r1_ops': case 'r1_comp': {
          if (!Array.isArray(ans) || ans.length !== d.answer.length) return { ok: false, fb: { msg: 'أكملي جميع الأقراص' } };
          const right = ans.map((v, i) => Number(v) === d.answer[i]);
          const nRight = right.filter(Boolean).length;
          return { ok: nRight === d.answer.length, fb: { right: nRight, total: d.answer.length, mask: right } };
        }
        case 'r2_points': {
          if (!Array.isArray(ans)) return { ok: false, fb: {} };
          const pts = ans.map(p => [Number(p[0]), Number(p[1])]);
          const want = new Set(d.answer.map(p => p.join(',')));
          const good = pts.filter(p => want.has(p.join(','))).length;
          return { ok: sameSet(pts, d.answer), fb: { good, bad: pts.length - good, total: d.answer.length } };
        }
        case 'r2_line': {
          if (!Array.isArray(ans) || ans.length !== 2) return { ok: false, fb: { msg: 'اختاري نقطتين' } };
          const pts = ans.map(p => [Number(p[0]), Number(p[1])]);
          if (pts[0][0] === pts[1][0] && pts[0][1] === pts[1][1]) return { ok: false, fb: { msg: 'النقطتان متطابقتان' } };
          const onInv = pts.map(([x, y]) => x === d.m * y + d.k);
          return { ok: onInv[0] && onInv[1], fb: { onInv } };
        }
        case 'r3_m1': case 'r3_m2': case 'r3_m3': {
          if (!Array.isArray(ans) || ans.length !== d.slots || ans.some(s => !'ABCD'.includes(s))) return { ok: false, fb: { msg: 'املئي كل الآلات' } };
          const xs = [-3, -2, -1, 0, 1, 2, 3];
          const tgt = x => machineEval(d, d.answer, x);
          const ok = xs.every(x => machineEval(d, ans, x) === tgt(x));
          return { ok, fb: { x: 1, got: machineEval(d, ans, 1), want: tgt(1), x2: 2, got2: machineEval(d, ans, 2), want2: tgt(2) } };
        }
        case 'r4_match': {
          if (!ans || typeof ans !== 'object') return { ok: false, fb: {} };
          let good = 0;
          d.funcs.forEach(fn => { const ci = ans[fn.key]; if (Number.isInteger(ci) && d.cands[ci] && isInversePair(fn.ev, d.cands[ci].ev)) good++; });
          return { ok: good === d.funcs.length, fb: { good, total: d.funcs.length } };
        }
        case 'r5_wires': {
          if (!Array.isArray(ans)) return { ok: false, fb: {} };
          const cut = Array.from(new Set(ans.map(Number)));
          const want = new Set(d.answer);
          const wrong = cut.filter(i => !want.has(i));
          if (wrong.length) return { ok: false, fb: { wrong } };
          if (cut.length < want.size) return { ok: false, partial: true, fb: { left: want.size - cut.length } };
          return { ok: true, fb: {} };
        }
        case 'r5_key': {
          const v = Number(ans);
          if (!isInt(v)) return { ok: false, fb: { msg: 'أدخلي عددًا صحيحًا' } };
          const fv = d.kind === 'lin' ? d.a * v + d.b : v * v * v + d.c;
          return { ok: v === d.answer, fb: { tried: v, fOfTried: fv, target: d.v } };
        }
        case 'r5_final': {
          const v = Number(ans);
          if (!Number.isFinite(v)) return { ok: false, fb: { msg: 'أدخلي عددًا' } };
          return { ok: v === d.answer, fb: { tried: v, fOfTried: d.a * v + d.b, gp: d.gp } };
        }
      }
    } catch (e) { return { ok: false, fb: { msg: 'إجابة غير صالحة' } }; }
    return { ok: false, fb: {} };
  }

  // ---------- التلميحات المتدرجة (لا تكشف الحل) ----------
  function hints(d) {
    switch (d.id) {
      case 'r1_ops': {
        const c = d.clues;
        return [
          'في العمليات على الدوال نحسب كل دالة عند العدد ثم نُجري العملية: ' + M('(f + g)(x) = f(x) + g(x)') + ' و ' + M('(f · g)(x) = f(x) · g(x)') + ' و ' + M('(f / g)(x) = f(x) / g(x)') + '.',
          'ابدئي بالرقمين ① و ②: ' + M('f(' + n(c[0].x) + ') = ' + n(c[0].fx)) + ' ، ' + M('g(' + n(c[0].x) + ') = ' + n(c[0].gx)) + ' ، ' + M('f(' + n(c[1].x) + ') = ' + n(c[1].fx)) + ' ، ' + M('g(' + n(c[1].x) + ') = ' + n(c[1].gx)) + '.',
          'للرقمين ③ و ④: ' + M('f(' + n(c[2].x) + ') = ' + n(c[2].fx)) + ' ، ' + M('g(' + n(c[2].x) + ') = ' + n(c[2].gx)) + ' ، ' + M('f(' + n(c[3].x) + ') = ' + n(c[3].fx)) + ' ، ' + M('g(' + n(c[3].x) + ') = ' + n(c[3].gx)) + '. انتبهي للإشارات!'
        ];
      }
      case 'r1_comp': {
        const c = d.clues;
        return [
          M('(f ∘ g)(x) = f(g(x))') + ': نبدأ دائمًا بالدالة الداخلية (اليمنى) ثم نعوّض الناتج في الخارجية.',
          'في الرقم ①: احسبي ' + M('g(' + n(c[0].x) + ') = ' + n(c[0].innerVal)) + ' أولًا، ثم عوّضي الناتج في f.',
          'في الرقم ②: ' + M('f(' + n(c[1].x) + ') = ' + n(c[1].innerVal)) + ' ثم عوّضي في g. وفي الرقم ③: ' + M('g(' + n(c[2].x) + ') = ' + n(c[2].innerVal)) + ' ثم عوّضي في g مرة أخرى.'
        ];
      }
      case 'r2_points':
        return [
          'معكوس العلاقة نحصل عليه بتبديل الإحداثيين في كل زوج مرتب.',
          'المرآة هي المستقيم ' + M('y = x') + ': كل نقطة تنعكس إلى الجهة الأخرى منه بالمسافة نفسها.',
          'النقطة ' + M('(' + n(d.points[0][0]) + ', ' + n(d.points[0][1]) + ')') + ' يقابلها في المعكوس النقطة التي إحداثيها السيني ' + M(n(d.points[0][1])) + '.'
        ];
      case 'r2_line':
        return [
          'منحنى الدالة العكسية هو انعكاس منحنى الدالة حول المستقيم ' + M('y = x') + '.',
          'اختاري أي نقطة على المستقيم البرتقالي ثم بدّلي إحداثييها، فتحصلين على نقطة على المعكوس.',
          'النقطة ' + M('(0, ' + n(d.k) + ')') + ' تقع على f، إذن النقطة ' + M('(' + n(d.k) + ', 0)') + ' تقع على ' + M(INV) + '. ابحثي عن نقطة ثانية بالطريقة نفسها.'
        ];
      case 'r3_m1':
        return [
          'في السلسلة ' + M('x → ① → ②') + ' تعمل الآلة ① أولًا، فالناتج هو ' + M('②(①(x))') + '.',
          'حلّلي ' + M('h(x) = ' + d.target) + ' بإخراج عامل مشترك.',
          M(d.target + ' = ' + d.b + '(x + ' + d.a + ')') + ' — أي عملية حدثت أولًا: الجمع أم الضرب؟'
        ];
      case 'r3_m2':
        return [
          'جرّبي إدخال عدد صغير مثل ' + M('x = 1') + ' في السلسلة وتتبعي ما يحدث له.',
          'هل ' + M('h(x) = ' + d.target) + ' تساوي ' + M('(x + ' + d.a + ')' + SQ) + '؟ عوّضي ' + M('x = 1') + ' في الاثنين وقارني.',
          'التربيع وقع على x وحدها، ثم أُضيف العدد بعده.'
        ];
      case 'r3_m3':
        return [
          'هذه الصورة المفكوكة تخفي مربعًا كاملًا. تذكّري: ' + M('(p + q)' + SQ + ' = p' + SQ + ' + 2pq + q' + SQ) + '.',
          M(d.target + ' = (' + d.b + 'x + ' + d.a + ')' + SQ) + '. الآن فكّري: ما العملية التي تحدث لـ x أولًا؟',
          'التربيع هو آخر عملية (الآلة ③). وقبله يُضاف ' + M(String(d.a)) + '.'
        ];
      case 'r4_match':
        return [
          'الدالتان f و g عكسيتان إذا كان ' + M('f(g(x)) = x') + ' و ' + M('g(f(x)) = x') + '. استخدمي «مِسبار الأرواح» لتجربة أي زوج بعدد.',
          'لإيجاد ' + M(INV) + ': اكتبي ' + M('y = f(x)') + '، بدّلي x و y، ثم حلّي بالنسبة لـ y.',
          'انتبهي: الدالة ' + M(d.params.k3 + ' ' + MINUS + ' x') + ' معكوسها هو نفسها! ومعكوس ' + M('x' + CU + plus(d.params.c4)) + ' يبدأ بطرح ' + M(n(d.params.c4)) + ' ثم الجذر التكعيبي.'
        ];
      case 'r5_wires':
        return [
          'الدالة لها دالة عكسية فقط إذا كانت متباينة (واحد لواحد): كل مستقيم أفقي يقطع منحناها مرة واحدة على الأكثر.',
          'حرّكي المسطرة الأفقية الذهبية فوق كل منحنى. إذا قطعته في نقطتين أو أكثر عند أي ارتفاع، فالسلك يجب قطعه.',
          'عدد الأسلاك التي يجب قطعها: ' + d.answer.length + '. احذري المنحنيات التي تصعد ثم تهبط ولو قليلًا.'
        ];
      case 'r5_key':
        return [
          M(INV + '(' + n(d.v) + ') = a') + ' تعني أن ' + M('f(a) = ' + n(d.v)) + '.',
          'حلّي المعادلة ' + M(d.f + ' = ' + n(d.v)) + '.',
          d.kind === 'lin' ? 'انقلي ' + M(n(d.b)) + ' إلى الطرف الآخر ثم اقسمي على ' + M(n(d.a)) + '.' : 'اطرحي ' + M(n(d.c)) + ' من الطرفين ثم خذي الجذر التكعيبي.'
        ];
      case 'r5_final':
        return [
          M('(' + INV + ' ∘ g)(' + n(d.p) + ') = ' + INV + '(g(' + n(d.p) + '))') + ': ابدئي بالداخلية g.',
          M('g(' + n(d.p) + ') = ' + n(d.gp)) + '. الآن ابحثي عن العدد الذي تحوّله f إلى ' + M(n(d.gp)) + '.',
          'حلّي ' + M(d.f + ' = ' + n(d.gp)) + '.'
        ];
    }
    return [];
  }

  // إجابة صالحة للإرسال (تُستخدم في الاختبارات الآلية فقط)
  function solution(d) { return d.id === 'r2_line' ? [d.answer[0], d.answer[1]] : d.answer; }

  // ---------- النقاط ----------
  function puzzleScore(hintsUsed, wrong) { return Math.max(30, 100 - 15 * (hintsUsed || 0) - 10 * (wrong || 0)); }
  function isGem(hintsUsed, wrong) { return (hintsUsed || 0) === 0 && (wrong || 0) <= 1; }

  const api = {
    PUZZLES, ROOM_OF, ROOMS, TITLES, BOMB,
    generate, check, hints, solution, puzzleScore, isGem,
    machineEval, tileFn, wireFn, isInversePair, makeRng,
    fmt: { n, lin, frac, M, SQ, CU, INV, MINUS, cbrt }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CastlePuzzles = api;
})(typeof window !== 'undefined' ? window : globalThis);
