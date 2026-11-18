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

  const PUZZLES = ['r1_ops', 'r1_comp', 'r2_points', 'r2_line', 'r3_m1', 'r3_m2', 'r4_match', 'r5_wires', 'r5_key'];
  const ROOM_OF = { r1_ops: 1, r1_comp: 1, r2_points: 2, r2_line: 2, r3_m1: 3, r3_m2: 3, r3_m3: 3, r4_match: 4, r5_wires: 5, r5_key: 5, r5_final: 5 };
  const BOMB = ['r5_wires', 'r5_key'];
  const ROOMS = [
    { id: 1, name: 'بوابة الشفرات', icon: '🔐', skill: 'العمليات على الدوال وتركيبها' },
    { id: 2, name: 'قاعة المرايا العكسية', icon: '🪞', skill: 'العلاقات العكسية والانعكاس حول y = x' },
    { id: 3, name: 'مختبر الخيميائي', icon: '⚗️', skill: 'تركيب الدوال وتفكيكها' },
    { id: 4, name: 'سرداب الأرواح المتطابقة', icon: '🔮', skill: 'إيجاد الدالة العكسية والتحقق منها' },
    { id: 5, name: 'خزانة الكنز', icon: '💣', skill: 'اختبار الخط الأفقي وقيم الدالة العكسية' }
  ];
  const TITLES = {
    r1_ops: 'قفل العمليات', r1_comp: 'قفل التركيب', r2_points: 'مرآة الأزواج', r2_line: 'جدول المرآة',
    r3_m1: 'الآلة الأولى', r3_m2: 'الآلة الثانية', r3_m3: 'الآلة الكبرى', r4_match: 'دائرة الأرواح',
    r5_wires: 'أسلاك الخط الأفقي', r5_key: 'لوحة المعكوس', r5_final: 'الصمام الأخير'
  };

  // ---------- المولّدات ----------
  const GEN = {};

  // الغرفة 1-أ: العمليات على الدوال (قفل من 4 أرقام)
  GEN.r1_ops = function (R) {
    // نسخة مبسّطة: f(x) = x + a ، g(x) = 2x ، وثلاث عمليات بأعداد صغيرة
    for (let t = 0; t < 500; t++) {
      const a = R.int(1, 3), b = 0, c = 0;
      const f = x => x + a, g = x => 2 * x;
      const ops = [
        { sym: '+', ev: x => f(x) + g(x) },
        { sym: MINUS, ev: x => f(x) - g(x) },
        { sym: '·', ev: x => f(x) * g(x) }
      ];
      const picks = []; let ok = true;
      for (const op of ops) {
        const xs = [];
        for (let x = 0; x <= 3; x++) { const v = op.ev(x); if (v >= 0 && v <= 9) xs.push(x); }
        if (!xs.length) { ok = false; break; }
        const x = R.pick(xs);
        picks.push({ sym: op.sym, x, val: op.ev(x), fx: f(x), gx: g(x) });
      }
      if (!ok) continue;
      const digits = picks.map(p => p.val);
      if (new Set(digits).size < 2) continue;
      return { a, b, c, f: lin(1, a), g: '2x', clues: picks, answer: digits };
    }
    throw new Error('r1_ops gen failed');
  };

  // الغرفة 1-ب: تركيب الدوال (قفل من رقمين) — نسخة مبسّطة
  GEN.r1_comp = function (R) {
    const a = R.int(1, 3);
    const f = x => x + a, g = x => 2 * x;
    const p = R.int(1, 3), q = R.int(1, 4 - a);
    const clues = [
      { label: '(f ∘ g)', x: p, val: f(g(p)), inner: 'g', innerVal: g(p) },
      { label: '(g ∘ f)', x: q, val: g(f(q)), inner: 'f', innerVal: f(q) }
    ];
    return { a, f: lin(1, a), g: '2x', clues, answer: clues.map(c => c.val) };
  };

  // الغرفة 2-أ: معكوس علاقة (نقاط)
  GEN.r2_points = function (R) {
    // نسخة مبسّطة: 3 نقاط في الربع الأول بإحداثيات من 1 إلى 5
    for (let t = 0; t < 500; t++) {
      const pts = [];
      const seen = new Set();
      while (pts.length < 3) {
        const x = R.int(1, 5), y = R.int(1, 5);
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

  // الغرفة 2-ب: الدالة العكسية من جدول قيم (بدون رسم)
  GEN.r2_line = function (R) {
    const m = R.pick([1, 2, 3]), k = R.int(1, 4);
    const xs = [1, 2, 3, 4], ys = xs.map(x => m * x + k);
    const qi = R.shuffle([0, 1, 2, 3]).slice(0, 2);
    return { m, k, f: lin(m, k), xs, ys, asks: qi.map(i => ys[i]), answer: qi.map(i => xs[i]) };
  };

  // الغرفة 3: آلات التركيب
  function machineTiles(R) {
    const a = R.int(1, 3), b = R.pick([2, 3]);
    return {
      a, b, d: 0,
      tiles: [
        { id: 'A', label: 'x + ' + a, ev: null },
        { id: 'B', label: b + 'x', ev: null },
        { id: 'C', label: 'x' + SQ, ev: null }
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
    return Object.assign(t, { slots: 2, target: lin(t.b, t.a, 'x'), answer: ['B', 'A'] });
  };
  GEN.r3_m2 = function (R) {
    const t = machineTiles(R);
    return Object.assign(t, { slots: 2, target: '(x + ' + t.a + ')' + SQ, answer: ['A', 'C'] });
  };
  GEN.r3_m3 = GEN.r3_m2;

  // الغرفة 4: مطابقة الدالة بدالتها العكسية
  GEN.r4_match = function (R) {
    // نسخة مبسّطة: 3 دوال خطية من نوع الكتاب، وظل مزيّف واحد
    for (let tr = 0; tr < 500; tr++) {
      const a = R.int(2, 6), b = R.int(2, 5), c = R.int(1, 5);
      if (a === b || c === a || c === b) continue;
      const fs = [
        { tex: 'x + ' + a, ev: x => x + a },
        { tex: b + 'x', ev: x => b * x },
        { tex: 'x ' + MINUS + ' ' + c, ev: x => x - c }
      ];
      const invs = [
        { tex: 'x ' + MINUS + ' ' + a, ev: x => x - a },
        { tex: frac('x', String(b)), ev: x => x / b },
        { tex: 'x + ' + c, ev: x => x + c }
      ];
      const decoys = [{ tex: 'x ' + MINUS + ' ' + b, ev: x => x - b }];
      const all = invs.map((v, i) => Object.assign({ key: 'i' + i }, v)).concat(decoys.map((v, i) => Object.assign({ key: 'd' + i }, v)));
      const cands = R.shuffle(all);
      const order = R.shuffle([0, 1, 2]);
      const funcs = order.map(i => Object.assign({ key: 'f' + i }, fs[i]));
      const answer = {};
      funcs.forEach(fn => { answer[fn.key] = cands.findIndex(c2 => c2.key === 'i' + fn.key.slice(1)); });
      return { funcs, cands, answer, params: { a, b, c } };
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
      { tex: 'x' + CU, ev: x => x * x * x },
      { tex: '3 ' + MINUS + ' x', ev: x => 3 - x },
      { tex: 'x + 2', ev: x => x + 2 }
    ],
    non: [
      { tex: 'x' + SQ, ev: x => x * x },
      { tex: '|x|', ev: x => Math.abs(x) },
      { tex: 'x' + SQ + ' ' + MINUS + ' 4', ev: x => x * x - 4 },
      { tex: '|x| ' + MINUS + ' 2', ev: x => Math.abs(x) - 2 }
    ]
  };
  GEN.r5_wires = function (R) {
    const inj = R.shuffle(GRAPH_POOL.inj.map((g, i) => ({ pool: 'inj', i }))).slice(0, 2);
    const non = R.shuffle(GRAPH_POOL.non.map((g, i) => ({ pool: 'non', i }))).slice(0, 2);
    const wires = R.shuffle(inj.concat(non));
    const colors = R.shuffle(['#ef4444', '#3b82f6', '#22c55e', '#eab308']);
    wires.forEach((w, i) => { w.color = colors[i]; const g = GRAPH_POOL[w.pool][w.i]; w.tex = g.tex; });
    const answer = wires.map((w, i) => (w.pool === 'non' ? i : -1)).filter(i => i >= 0);
    return { wires, answer };
  };
  function wireFn(w) { return GRAPH_POOL[w.pool][w.i].ev; }

  // الغرفة 5-ب: قيمة الدالة العكسية
  GEN.r5_key = function (R) {
    // نسخة مبسّطة: دالة خطية وناتج موجب صغير
    const t = R.int(1, 9);
    if (R() < 0.5) { const a = R.int(2, 9); return { kind: 'lin', a: 1, b: a, f: lin(1, a), v: t + a, answer: t }; }
    const b = R.int(1, 5); return { kind: 'lin', a: 2, b, f: lin(2, b), v: 2 * t + b, answer: t };
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
          const mask = d.answer.map((p, i) => !!pts[i] && pts[i][0] === p[0] && pts[i][1] === p[1]);
          return { ok: sameSet(pts, d.answer), fb: { good, bad: pts.length - good, total: d.answer.length, mask } };
        }
        case 'r2_line': {
          if (!Array.isArray(ans) || ans.length !== d.answer.length) return { ok: false, fb: { msg: 'أكملي الأقراص' } };
          const mask = d.answer.map((v, i) => Number(ans[i]) === v);
          return { ok: mask.every(Boolean), fb: { mask, right: mask.filter(Boolean).length, total: mask.length } };
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
          'احسبي f و g عند العدد نفسه، ثم اجمعي أو اطرحي أو اضربي.',
          'للرقم ①: ' + M('f(' + c[0].x + ') = ' + c[0].fx) + ' و ' + M('g(' + c[0].x + ') = ' + c[0].gx) + '.',
          'للرقم ②: ' + M('f(' + c[1].x + ') = ' + c[1].fx + ' ، g(' + c[1].x + ') = ' + c[1].gx) + ' — وللرقم ③: ' + M('f(' + c[2].x + ') = ' + c[2].fx + ' ، g(' + c[2].x + ') = ' + c[2].gx) + '.'
        ];
      }
      case 'r1_comp': {
        const c = d.clues;
        return [
          'ابدئي بالدالة اليمنى (الداخلية)، ثم ضعي الناتج في الدالة اليسرى.',
          'للرقم ①: ' + M('g(' + c[0].x + ') = ' + c[0].innerVal) + '، والآن احسبي ' + M('f(' + c[0].innerVal + ')') + '.',
          'للرقم ②: ' + M('f(' + c[1].x + ') = ' + c[1].innerVal) + '، والآن احسبي ' + M('g(' + c[1].innerVal + ')') + '.'
        ];
      }
      case 'r2_points':
        return [
          'معكوس العلاقة نحصل عليه بتبديل الإحداثيين في كل زوج مرتب: ' + M('(a, b) → (b, a)') + '.',
          'المرآة تقلب الزوج: العدد الأول يصبح ثانيًا، والثاني يصبح أولًا.',
          'معكوس ' + M('(' + n(d.points[0][0]) + ', ' + n(d.points[0][1]) + ')') + ' يبدأ بالعدد ' + M(n(d.points[0][1])) + '.'
        ];
      case 'r2_line':
        return [
          M(INV + '(b) = a') + ' تعني أن ' + M('f(a) = b') + ': الدالة العكسية تعكس الجدول، فالمُخرَج يصبح مُدخلًا.',
          'ابحثي عن العدد في صف ' + M('f(x)') + ' ثم انظري إلى العدد الذي فوقه في صف ' + M('x') + '.',
          'لإيجاد ' + M(INV + '(' + d.asks[0] + ')') + ': أين يقع العدد ' + M(String(d.asks[0])) + ' في الصف الثاني؟ وما العدد المكتوب فوقه؟'
        ];
      case 'r3_m1':
        return [
          'جرّبي ترتيبًا وشغّلي الآلة: ستظهر لك القيم عند x = 1 وتقارنينها بالمطلوب.',
          'في ' + M(d.target) + ' : الضرب في ' + d.b + ' حدث أولًا، ثم الجمع.',
          'الآلة ① = ' + M(d.b + 'x') + '.'
        ];
      case 'r3_m2': case 'r3_m3':
        return [
          'جرّبي ترتيبًا وشغّلي الآلة: ستظهر لك القيم عند x = 1.',
          'في ' + M(d.target) + ' : الجمع داخل القوس حدث أولًا، ثم التربيع.',
          'الآلة ① = ' + M('x + ' + d.a) + '.'
        ];
      case 'r4_match':
        return [
          'الدالة العكسية تعكس العملية: الجمع ↔ الطرح، والضرب ↔ القسمة.',
          'معكوس ' + M('x + ' + d.params.a) + ' هو ' + M('x ' + MINUS + ' ' + d.params.a) + '.',
          'استخدمي المِسبار: إذا عاد العدد إلى نفسه فالربط صحيح.'
        ];
      case 'r5_wires':
        return [
          'الدالة لها دالة عكسية فقط إذا كانت متباينة (واحد لواحد): كل مستقيم أفقي يقطع منحناها مرة واحدة على الأكثر.',
          'حرّكي المسطرة الأفقية الذهبية فوق كل منحنى. إذا قطعته في نقطتين أو أكثر عند أي ارتفاع، فالسلك يجب قطعه.',
          'عدد الأسلاك التي يجب قطعها: ' + d.answer.length + '. المنحنيات التي تنزل ثم تصعد (مثل حرف U أو V) ليس لها دالة عكسية.'
        ];
      case 'r5_key':
        return [
          M(INV + '(' + n(d.v) + ') = a') + ' تعني أن ' + M('f(a) = ' + n(d.v)) + '.',
          'حلّي المعادلة ' + M(d.f + ' = ' + n(d.v)) + '.',
          'اطرحي ' + M(n(d.b)) + ' من ' + M(n(d.v)) + (d.a !== 1 ? ' ثم اقسمي على ' + M(n(d.a)) : '') + '.'
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

  // ---------- بطاقة القاعدة الظاهرة دائمًا مع كل لغز ----------
  const RULES = {
    r1_ops: M('(f + g)(x) = f(x) + g(x)') + '<br>' + M('(f ' + MINUS + ' g)(x) = f(x) ' + MINUS + ' g(x)') + '<br>' + M('(f · g)(x) = f(x) · g(x)') + '<br><small>مثال: إذا ' + M('f(1) = 3') + ' و ' + M('g(1) = 2') + ' فإن ' + M('(f + g)(1) = 5') + '</small>',
    r1_comp: M('(f ∘ g)(x) = f(g(x))') + ' : احسبي <b>g أولًا</b> ثم ضعي الناتج في f.<br><small>مثال: ' + M('f(x) = x + 1 ، g(x) = 2x') + ' ⇐ ' + M('(f ∘ g)(3) = f(6) = 7') + '</small>',
    r2_points: 'معكوس الزوج ' + M('(a, b)') + ' هو ' + M('(b, a)') + '<br><small>مثال: ' + M('(2, 7) → (7, 2)') + '</small>',
    r2_line: 'إذا كان ' + M('f(a) = b') + ' فإن ' + M(INV + '(b) = a') + '<br><small>مثال: ' + M('f(3) = 8') + ' ⇐ ' + M(INV + '(8) = 3') + '</small>',
    r3_m1: 'الآلة ① تعمل أولًا ثم ②.<br><small>مثال: ' + M('2x') + ' ثم ' + M('x + 1') + ' تعطي ' + M('2x + 1') + '، أما ' + M('x + 1') + ' ثم ' + M('2x') + ' فتعطي ' + M('2(x + 1)') + '</small>',
    r4_match: 'الدالة العكسية تعكس العملية: <b>الجمع ↔ الطرح</b> و <b>الضرب ↔ القسمة</b>.<br><small>مثال: معكوس ' + M('x + 3') + ' هو ' + M('x ' + MINUS + ' 3') + '، ومعكوس ' + M('4x') + ' هو ' + frac('x', '4') + '</small>',
    r5: 'السلك: الدالة لها عكسية إذا قطع <b>أي خط أفقي</b> منحناها مرة واحدة فقط.<br>اللوحة: ' + M(INV + '(b) = a') + ' تعني ' + M('f(a) = b') + '.'
  };
  RULES.r3_m2 = RULES.r3_m3 = RULES.r3_m1;

  // ---------- النقاط ----------
  function puzzleScore(hintsUsed, wrong) { return Math.max(30, 100 - 15 * (hintsUsed || 0) - 10 * (wrong || 0)); }
  function isGem(hintsUsed, wrong) { return (hintsUsed || 0) === 0 && (wrong || 0) <= 1; }

  const api = {
    PUZZLES, ROOM_OF, ROOMS, TITLES, BOMB,
    generate, check, hints, solution, RULES, puzzleScore, isGem,
    machineEval, tileFn, wireFn, isInversePair, makeRng,
    fmt: { n, lin, frac, M, SQ, CU, INV, MINUS, cbrt }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CastlePuzzles = api;
})(typeof window !== 'undefined' ? window : globalThis);
