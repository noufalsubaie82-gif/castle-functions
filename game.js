/* «الهروب من قلعة الدوال» — واجهة الطالبة */
(function () {
  'use strict';
  const P = window.CastlePuzzles, F = P.fmt, M = F.M, n = F.n;
  const app = document.getElementById('app');
  const LS = 'castle_v1';
  const CLASSES = ['ثاني ثانوي 4', 'ثاني ثانوي 5', 'ثاني ثانوي 6', 'ثاني ثانوي 7'];
  const BOMB_SECONDS = 480;

  // ---------- التخزين المحلي ----------
  let local = {};
  try { local = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { local = {}; }
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(local)); } catch (e) { } }
  local.ui = local.ui || {};
  let me = null;
  function setMe(p) {
    if (!p) return;
    me = p;
    Object.assign(local, { pid: p.pid, name: p.name, cls: p.cls, seed: p.seed, answers: p.answers, hints: p.hints, wrong: p.wrong, bombVariant: p.bombVariant, explosions: p.explosions, joinedAt: p.joinedAt, lastActive: Date.now() });
    saveLocal();
    renderHud();
  }

  // ---------- الاتصال بالخادم ----------
  let queue = []; try { queue = JSON.parse(localStorage.getItem(LS + '_q') || '[]'); } catch (e) { }
  function saveQueue() { try { localStorage.setItem(LS + '_q', JSON.stringify(queue)); } catch (e) { } }
  async function api(path, body) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      j._status = r.status; setNet(true);
      return j;
    } catch (e) { setNet(false); throw e; } finally { clearTimeout(to); }
  }
  let netEl = null;
  function setNet(ok) {
    if (ok && netEl) { netEl.remove(); netEl = null; }
    if (!ok && !netEl) { netEl = document.createElement('div'); netEl.className = 'net'; netEl.textContent = '⚠️ انقطع الاتصال — تقدمك محفوظ وسيُرسل تلقائيًا'; document.body.appendChild(netEl); }
  }
  let flushing = false;
  async function flush() {
    if (flushing || !queue.length || !me) return;
    flushing = true;
    try {
      while (queue.length) {
        const item = queue[0];
        const r = await api(item.path, item.body);
        if (r.player) setMe(r.player);
        queue.shift(); saveQueue();
      }
    } catch (e) { } finally { flushing = false; }
  }
  setInterval(flush, 4000);

  let view = 'join';
  function setView(v) { view = v; ping(); }
  async function ping() { if (!me) return; try { await api('/api/ping', { pid: me.pid, view }); flush(); } catch (e) { } }
  setInterval(ping, 10000);

  async function submit(id, answer) {
    const variant = P.BOMB.includes(id) ? (me.bombVariant || 0) : 0;
    const body = { pid: me.pid, id, variant, answer };
    try {
      const r = await api('/api/attempt', body);
      if (r.player) setMe(r.player);
      if (r._status === 409) return { stale: true };
      return r;
    } catch (e) {
      // بدون اتصال: نصحّح محليًا بالمحرك نفسه ونرسل لاحقًا (الخادم يعيد التصحيح)
      const res = P.check(id, me.seed, variant, answer);
      queue.push({ path: '/api/attempt', body }); saveQueue();
      if (res.ok) { const h = me.hints[id] || 0, w = me.wrong[id] || 0; me.solved[id] = { at: Date.now(), hints: h, wrong: w, gem: P.isGem(h, w) }; me.answers[id] = { v: variant, a: answer }; me.solvedCount++; }
      else if (!res.partial) me.wrong[id] = (me.wrong[id] || 0) + 1;
      setMe(me);
      return { ok: res.ok, partial: res.partial, fb: res.fb, offline: true };
    }
  }
  async function takeHint(id) {
    try { const r = await api('/api/hint', { pid: me.pid, id }); if (r.player) setMe(r.player); }
    catch (e) { queue.push({ path: '/api/hint', body: { pid: me.pid, id } }); saveQueue(); me.hints[id] = Math.min(3, (me.hints[id] || 0) + 1); setMe(me); }
  }

  // ---------- أدوات واجهة ----------
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function toast(msg, cls) { const t = h('<div class="toast ' + (cls || '') + '"></div>'); t.innerHTML = msg; document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 3600); }
  function fb(el, msg, cls) { el.className = 'feedback ' + (cls || ''); el.innerHTML = msg; }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function modal(inner) {
    const bg = h('<div class="modal-bg"><div class="modal panel"></div></div>');
    bg.querySelector('.modal').append(typeof inner === 'string' ? h('<div>' + inner + '</div>') : inner);
    bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg); return bg;
  }
  const solved = id => !!(me && me.solved[id]);
  const roomDone = r => P.PUZZLES.filter(id => P.ROOM_OF[id] === r).every(solved);
  function currentRoom() { for (const r of [1, 2, 3, 4, 5]) if (!roomDone(r)) return r; return 6; }
  function scoreLocal() { return me ? me.score : 0; }

  // ---------- السماء والمؤثرات ----------
  (function sky() {
    const c = document.getElementById('sky'), x = c.getContext('2d'); let stars = [];
    function size() { c.width = innerWidth; c.height = innerHeight; stars = Array.from({ length: Math.min(180, innerWidth / 6) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height * .8, r: Math.random() * 1.4 + .2, p: Math.random() * 6 })); }
    size(); addEventListener('resize', size);
    (function loop(t) { x.clearRect(0, 0, c.width, c.height); for (const s of stars) { x.globalAlpha = .35 + .65 * Math.abs(Math.sin(t / 1400 + s.p)); x.fillStyle = '#fff'; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); } requestAnimationFrame(loop); })(0);
  })();
  const fx = (function () {
    const c = document.getElementById('fx'), x = c.getContext('2d'); let parts = [], running = false;
    function size() { c.width = innerWidth; c.height = innerHeight; } size(); addEventListener('resize', size);
    function loop() {
      x.clearRect(0, 0, c.width, c.height);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--; x.save(); x.globalAlpha = Math.min(1, p.life / 40); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.c; if (p.s === 'star') { x.font = p.size * 2 + 'px serif'; x.fillText(p.ch, 0, 0); } else x.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); x.restore(); }
      if (parts.length) requestAnimationFrame(loop); else { running = false; x.clearRect(0, 0, c.width, c.height); }
    }
    function go() { if (!running) { running = true; requestAnimationFrame(loop); } }
    const COLS = ['#f5c451', '#ef4444', '#22c55e', '#38bdf8', '#a78bfa', '#f472b6', '#fff'];
    return {
      confetti(n) { for (let i = 0; i < (n || 160); i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, g: .32, rot: Math.random() * 6, vr: (Math.random() - .5) * .4, size: 8 + Math.random() * 8, c: COLS[i % COLS.length], life: 120 + Math.random() * 80 }); go(); },
      sparkle(xp, yp, ch) { for (let i = 0; i < 18; i++) parts.push({ x: xp, y: yp, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, g: .05, rot: 0, vr: 0, size: 9, c: '#fff', s: 'star', ch: ch || '✨', life: 50 + Math.random() * 20 }); go(); }
    };
  })();

  // ---------- الشريط العلوي ----------
  let hudEl = null, hintFor = null;
  function renderHud() {
    if (!me || !hudEl) return;
    const keys = [1, 2, 3, 4, 5].map(r => '<span class="keyslot ' + (roomDone(r) ? 'on' : '') + '" title="' + P.ROOMS[r - 1].name + '">🗝️</span>').join('');
    hudEl.innerHTML =
      '<span class="who"><span class="av" style="border-color:' + me.color + '">' + me.avatar + '</span><span class="nm"></span></span>' +
      '<span class="keys">' + keys + '</span>' +
      '<span class="chip" title="الجواهر">💎 ' + me.gems + '</span>' +
      '<span class="chip" title="النقاط">⭐ ' + me.score + '</span>' +
      '<span class="chip time" id="elapsed"></span><span class="grow"></span>' +
      (hintFor ? '<button class="iconbtn" id="hintBtn" title="تلميح">🏮</button>' : '') +
      (view.startsWith('room') ? '<button class="iconbtn" id="mapBtn" title="الخريطة">🗺️</button>' : '') +
      '<button class="iconbtn" id="sndBtn" title="الصوت">' + (SFX.muted ? '🔇' : '🔊') + '</button>';
    hudEl.querySelector('.nm').textContent = me.name;
    const hb = hudEl.querySelector('#hintBtn'); if (hb) hb.onclick = () => openHints(hintFor);
    const mb = hudEl.querySelector('#mapBtn'); if (mb) mb.onclick = () => { SFX.click(); renderMap(); };
    hudEl.querySelector('#sndBtn').onclick = () => { SFX.toggle(); renderHud(); };
    tickElapsed();
  }
  function tickElapsed() { const e = document.getElementById('elapsed'); if (e && me) { const s = Math.floor((Date.now() - me.joinedAt) / 1000); e.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); } }
  setInterval(tickElapsed, 1000);
  function shell(inner) {
    app.innerHTML = '';
    hudEl = h('<div class="hud"></div>'); app.appendChild(hudEl);
    const w = h('<div class="wrap"></div>'); w.append(inner); app.appendChild(w);
    renderHud(); window.scrollTo(0, 0);
    return w;
  }

  // ---------- التلميحات ----------
  function openHints(id) {
    if (!id) return;
    SFX.click();
    const d = P.generate(id, me.seed, me.bombVariant);
    const all = P.hints(d);
    const box = h('<div><h2 class="title gold">🏮 مصباح التلميحات — ' + P.TITLES[id] + '</h2><div class="list"></div><p class="muted" style="margin:8px 0 0">كل تلميح جديد يخصم 15 نقطة من هذا اللغز، ويُفقدك جوهرته.</p><div class="actions"></div></div>');
    function draw() {
      const lvl = me.hints[id] || 0;
      box.querySelector('.list').innerHTML = lvl ? all.slice(0, lvl).map((t, i) => '<div class="hint-item"><b>تلميح ' + (i + 1) + ':</b> ' + t + '</div>').join('') : '<p class="lead">المصباح مطفأ… هل تريدين إشعاله؟</p>';
      const a = box.querySelector('.actions'); a.innerHTML = '';
      if (lvl < 3) { const b = h('<button class="btn">' + (lvl ? 'تلميح أعمق' : 'أشعلي المصباح') + ' (−15)</button>'); b.onclick = async () => { b.disabled = true; await takeHint(id); SFX.magic(); draw(); }; a.append(b); }
      const c = h('<button class="btn ghost">رجوع للغز</button>'); c.onclick = () => bg.remove(); a.append(c);
    }
    const bg = modal(box); draw();
  }

  // ---------- شاشة الدخول ----------
  const CASTLE_SVG = `<svg class="castle-hero" viewBox="0 0 520 300" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f63"/><stop offset="1" stop-color="#15102a"/></linearGradient>
    <radialGradient id="moon"><stop offset="0" stop-color="#fff8dc"/><stop offset=".7" stop-color="#f5e3a1"/><stop offset="1" stop-color="#f5e3a1" stop-opacity="0"/></radialGradient></defs>
    <circle cx="410" cy="60" r="48" fill="url(#moon)"/>
    <g class="bat"><path d="M0 0 q6 -8 12 0 q6 -8 12 0 q-6 3 -12 6 q-6 -3 -12 -6z" fill="#0b0820"/></g>
    <g class="bat" style="animation-delay:-4s"><path d="M0 20 q5 -6 10 0 q5 -6 10 0 q-5 2 -10 5 q-5 -3 -10 -5z" fill="#0b0820"/></g>
    <path d="M40 300 V170 h20 v-14 h12 v14 h14 v-14 h12 v14 h20 V300z M160 300 V110 h16 v-16 h12 v16 h14 v-16 h12 v16 h16 V300z M300 300 V120 h16 v-16 h12 v16 h14 v-16 h12 v16 h16 V300z M400 300 V160 h20 v-14 h12 v14 h14 v-14 h12 v14 h20 V300z" fill="url(#cw)"/>
    <path d="M150 104 L195 40 L240 104z M290 114 L335 52 L380 114z" fill="#4c1d95"/>
    <rect x="98" y="200" width="324" height="100" fill="url(#cw)"/>
    <path d="M230 300 v-56 a30 30 0 0 1 60 0 v56z" fill="#0b0820" stroke="#f5c451" stroke-width="3"/>
    <g class="window-glow" fill="#ffcf5a"><rect x="186" y="140" width="10" height="18" rx="5"/><rect x="326" y="150" width="10" height="18" rx="5"/><rect x="66" y="196" width="9" height="15" rx="4"/><rect x="446" y="190" width="9" height="15" rx="4"/><rect x="186" y="200" width="10" height="18" rx="5"/></g>
    <path d="M195 40 v-22 l18 6 -18 6" fill="#ef4444" stroke="#f5c451" stroke-width="1"/>
  </svg>`;
  function renderJoin(errMsg) {
    view = 'join';
    app.innerHTML = '';
    const opts = CLASSES.map(c => '<option' + (local.cls === c ? ' selected' : '') + '>' + c + '</option>').join('');
    const el = h(`<div class="join"><div style="width:min(520px,100%)">
      ${CASTLE_SVG}
      <div class="panel">
        <h1 class="game-title">الهروب من قلعة الدوال</h1>
        <p class="sub">خمس غرف… خمسة مفاتيح… وكنز ينتظر من تفكّ ألغاز الدوال</p>
        <p class="credit">إعداد: أ. نوف السبيعي</p>
        <label class="field"><span>اسمك</span><input id="nm" maxlength="30" autocomplete="off" placeholder="مثال: ريم خالد"></label>
        <label class="field"><span>فصلك</span><select id="cl"><option value="">— اختاري —</option>${opts}<option value="__o">فصل آخر…</option></select></label>
        <label class="field hidden" id="otherWrap"><span>اكتبي اسم الفصل</span><input id="clo" maxlength="20"></label>
        <div class="err" id="err"></div>
        <button class="btn" id="go" style="width:100%;font-size:1.25rem">🏰 ادخلي القلعة</button>
        <p class="muted center" style="font-size:.85rem;margin:12px 0 0">لا حاجة لحساب أو مايك أو كاميرا. تقدّمك يُحفظ تلقائيًا.</p>
      </div></div></div>`);
    app.appendChild(el);
    const nm = el.querySelector('#nm'), cl = el.querySelector('#cl'), clo = el.querySelector('#clo');
    nm.value = local.name || '';
    cl.onchange = () => el.querySelector('#otherWrap').classList.toggle('hidden', cl.value !== '__o');
    if (errMsg) el.querySelector('#err').textContent = errMsg;
    const go = el.querySelector('#go');
    async function doJoin() {
      SFX.unlockAudio(); SFX.click();
      const name = nm.value.trim(), cls = cl.value === '__o' ? clo.value.trim() : cl.value;
      if (name.length < 2) { el.querySelector('#err').textContent = 'اكتبي اسمك (حرفان على الأقل)'; return; }
      if (!cls) { el.querySelector('#err').textContent = 'اختاري فصلك'; return; }
      go.disabled = true; go.textContent = '... تُفتح البوابة';
      const ok = await join(name, cls);
      if (!ok) { go.disabled = false; go.textContent = '🏰 ادخلي القلعة'; }
    }
    go.onclick = doJoin;
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
  }
  async function join(name, cls) {
    const samePerson = local.pid && local.name === name && local.cls === cls;
    const body = { name, cls, pid: samePerson ? local.pid : undefined };
    if (samePerson && local.seed) body.backup = { pid: local.pid, seed: local.seed, answers: local.answers, hints: local.hints, wrong: local.wrong, bombVariant: local.bombVariant, explosions: local.explosions, joinedAt: local.joinedAt, session: local.session, lastActive: local.lastActive };
    try {
      const r = await api('/api/join', body);
      if (r.error) { const e = document.getElementById('err'); if (e) e.textContent = r.error; return false; }
      if (!samePerson && local.pid !== r.player.pid) { local.ui = {}; local.introSeen = false; queue = []; saveQueue(); }
      local.session = r.session;
      setMe(r.player);
      if (r.restored) toast('استعدنا تقدّمك: ' + r.restored + ' لغزًا ✔️', 'good');
      if (!local.introSeen && me.solvedCount === 0) renderIntro(); else renderMap();
      return true;
    } catch (e) {
      const el = document.getElementById('err'); if (el) el.textContent = 'تعذّر الاتصال بالقلعة. تأكدي من الإنترنت وحاولي مرة أخرى.';
      return false;
    }
  }

  // ---------- القصة ----------
  function renderIntro() {
    setView('intro');
    const text = 'يا ' + me.name + '…\nلقد سقطتِ في فخّ الساحر «مُرَكِّب» وحُبستِ داخل قلعة الدوال!\nللقلعة خمس غرف، ولكل غرفة لغز يحرسه سحر الدوال: أقفال مشفّرة، ومرايا تعكس كل شيء، وآلات تُركِّب الدوال، وأرواح تبحث عن معكوسها… وفي النهاية قنبلة تحرس الكنز.\nاجمعي المفاتيح الخمسة، وعطّلي القنبلة، واهربي بالكنز قبل الجميع!';
    app.innerHTML = '';
    const el = h('<div class="story wrap"><div class="parch"><div class="tw" style="white-space:pre-line"></div><div class="seal">م</div></div><div class="actions" style="margin-top:34px"><button class="btn" id="go" style="opacity:0;transition:opacity .5s">⚔️ ابدئي المغامرة</button></div></div>');
    app.appendChild(el);
    const tw = el.querySelector('.tw'); let i = 0; const go = el.querySelector('#go');
    const timer = setInterval(() => { i += 2; tw.textContent = text.slice(0, i); if (i % 6 === 0) SFX.tick(); if (i >= text.length) { clearInterval(timer); go.style.opacity = 1; } }, 28);
    el.querySelector('.parch').onclick = () => { i = text.length; };
    go.onclick = () => { clearInterval(timer); local.introSeen = true; saveLocal(); SFX.door(); renderMap(); };
  }

  // ---------- الخريطة ----------
  const NODES = [null, [120, 455], [345, 420], [575, 350], [390, 262], [160, 195], [440, 88]];
  function renderMap(fromRoom) {
    setView('map'); hintFor = null;
    const cur = currentRoom();
    const w = h('<div></div>');
    const path = NODES.slice(1).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    let doneLen = '';
    for (let r = 1; r < cur && r < 6; r++) doneLen += (r === 1 ? 'M' : 'L') + NODES[r][0] + ' ' + NODES[r][1] + ' L' + NODES[r + 1][0] + ' ' + NODES[r + 1][1] + ' ';
    const nodes = [1, 2, 3, 4, 5, 6].map(r => {
      const [x, y] = NODES[r]; const done = r < cur, isCur = r === cur, locked = r > cur;
      const info = r === 6 ? { name: 'الكنز والهروب', icon: '👑' } : P.ROOMS[r - 1];
      return `<g class="map-node ${isCur ? 'current' : ''}" data-r="${r}">
        <circle class="ring" cx="${x}" cy="${y}" r="50" fill="none" stroke="#f5c451" stroke-width="3"/>
        <circle cx="${x}" cy="${y}" r="40" fill="${done ? '#14532d' : locked ? '#1f1a33' : '#3b2a6b'}" stroke="${done ? '#22c55e' : '#f5c451'}" stroke-width="3"/>
        <text x="${x}" y="${y + 13}" text-anchor="middle" font-size="36" ${locked ? 'opacity=".35"' : ''}>${info.icon}</text>
        ${locked ? `<text x="${x + 26}" y="${y - 22}" font-size="22">🔒</text>` : ''}${done ? `<text x="${x + 26}" y="${y - 22}" font-size="22">🗝️</text>` : ''}
        <text x="${x}" y="${y + 66}" text-anchor="middle" font-size="19" font-weight="800" fill="${locked ? '#8b84a8' : '#ffe8a3'}" font-family="Tajawal">${info.name}</text></g>`;
    }).join('');
    w.innerHTML = `<div class="center" style="margin-top:6px"><h2 class="title gold" style="font-size:1.9rem">خريطة القلعة</h2><p class="muted" style="margin:0">${cur === 6 ? 'هربتِ من القلعة! 👑' : 'الغرفة التالية: <b class="gold">' + P.ROOMS[cur - 1].name + '</b> — المهارة: ' + P.ROOMS[cur - 1].skill}</p></div>
      <div class="mapwrap"><svg style="direction:ltr" viewBox="0 0 700 540" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="mw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2452"/><stop offset="1" stop-color="#120d26"/></linearGradient></defs>
        <path d="M20 540 V300 h40 v-24 h24 v24 h30 v-24 h24 v24 h40 V160 h30 v-26 h24 v26 h30 v-26 h24 v26 h30 V60 h34 v-28 h24 v28 h34 v-28 h24 v28 h34 V200 h40 v-26 h24 v26 h30 v-26 h24 v26 h40 V540z" fill="url(#mw)" stroke="#3d3170" stroke-width="3"/>
        <path d="${path}" fill="none" stroke="#f5c451" stroke-opacity=".35" stroke-width="7" stroke-dasharray="4 14" stroke-linecap="round"/>
        ${doneLen ? `<path d="${doneLen}" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round"/>` : ''}
        ${nodes}</svg><div class="me-token" style="border-color:${me.color}">${me.avatar}</div></div>
      <div class="actions">${cur < 6 ? '<button class="btn" id="enter" style="font-size:1.2rem">🚪 ادخلي ' + P.ROOMS[cur - 1].name + '</button>' : '<button class="btn" id="enter">👑 شاهدي كنزك</button>'}</div>`;
    shell(w);
    const tok = w.querySelector('.me-token');
    const place = r => { tok.style.left = (NODES[r][0] / 700 * 100) + '%'; tok.style.top = (NODES[r][1] / 540 * 100 - 6) + '%'; };
    if (fromRoom && fromRoom !== cur) { tok.style.transition = 'none'; place(fromRoom); void tok.offsetWidth; tok.style.transition = ''; setTimeout(() => { place(cur); SFX.magic(); }, 400); }
    else place(cur);
    const enter = () => { if (cur === 6) return renderTreasure(false); openDoor(() => renderRoom(cur)); };
    w.querySelector('#enter').onclick = enter;
    w.querySelectorAll('.map-node.current').forEach(g => g.addEventListener('click', enter));
  }
  function openDoor(next) { SFX.door(); const d = h('<div class="door3d"><div class="leaf"></div></div>'); document.body.appendChild(d); setTimeout(() => { d.remove(); next(); }, 1500); }

  // ---------- الغرف ----------
  function renderRoom(r) {
    const info = P.ROOMS[r - 1];
    const ids = P.PUZZLES.filter(id => P.ROOM_OF[id] === r);
    if (ids.every(solved)) return renderMap(r);
    const curId = r === 5 ? 'r5' : ids.find(id => !solved(id));
    const dots = r === 5 ? '' : ids.map(id => '<span class="stage-dot ' + (solved(id) ? 'done' : id === curId ? 'cur' : '') + '"></span>').join('');
    const w = h(`<div class="room"><div class="room-head"><span class="ic">${info.icon}</span><div><h2>${info.name}</h2><div class="stages">${dots}</div></div></div><div class="stone"><span class="torch l"></span><span class="torch r"></span><div class="stage" style="padding-top:44px"></div></div></div>`);
    view = 'room:' + curId; hintFor = r === 5 ? null : curId;
    const rule = P.RULES[curId];
    if (rule) w.querySelector('.room-head').insertAdjacentHTML('afterend', '<div class="parch rule"><b>📜 القاعدة:</b> ' + rule + '</div>');
    shell(w); ping();
    const box = w.querySelector('.stage');
    const done = async (id) => {
      SFX.good();
      const s = me.solved[id];
      if (s && s.gem) { setTimeout(() => { SFX.gem(); toast('💎 جوهرة! حللتِ «' + P.TITLES[id] + '» بلا تلميحات', 'good'); }, 400); }
      else toast('✔️ ' + P.TITLES[id], 'good');
      fx.sparkle(innerWidth / 2, innerHeight / 2);
      await wait(900);
      if (roomDone(r)) showKey(r); else renderRoom(r);
    };
    const R = { r1_ops: lockPuzzle, r1_comp: lockPuzzle, r2_points: pointsPuzzle, r2_line: linePuzzle, r3_m1: machinePuzzle, r3_m2: machinePuzzle, r3_m3: machinePuzzle, r4_match: matchPuzzle, r5: bombPuzzle };
    R[curId](box, curId, done);
  }
  function showKey(r) {
    SFX.key();
    const el = h(`<div class="reward"><div class="rays"></div><div class="center"><div class="bigkey">🗝️</div><h2 class="game-title" style="font-size:2.2rem">مفتاح ${P.ROOMS[r - 1].name}</h2><p class="lead">${r < 5 ? 'انفتح الطريق إلى الغرفة التالية…' : ''}</p><button class="btn">متابعة ➜</button></div></div>`);
    document.body.appendChild(el); fx.confetti(90);
    el.querySelector('button').onclick = () => { el.remove(); SFX.click(); if (r === 5) renderTreasure(true); else renderMap(r); };
  }

  // ===== الغرفة 1: الأقفال =====
  function lockPuzzle(box, id, done) {
    const d = P.generate(id, me.seed);
    const ui = local.ui[id] = local.ui[id] || { found: [], dials: d.answer.map(() => 0) };
    const items = (id === 'r1_ops' ? ['📜', '🛡️', '🏺', '🕯️', '📚'] : ['📜', '🪔', '💀', '🧪']).slice(0, d.answer.length + 1);
    const N = ['①', '②', '③', '④'];
    const clueHtml = (i) => {
      if (i === 0) return '<b>لفافة الساحر:</b><br>' + M('f(x) = ' + d.f) + '<br>' + M('g(x) = ' + d.g);
      const c = d.clues[i - 1];
      if (id === 'r1_ops') {
        const op = c.sym === '/' ? '(' + F.frac('f', 'g') + ')' : '(f ' + c.sym + ' g)';
        return '<span class="num">' + N[i - 1] + '</span> الرقم = ' + M(op + '(' + n(c.x) + ')');
      }
      return '<span class="num">' + N[i - 1] + '</span> الرقم = ' + M(c.label + '(' + n(c.x) + ')');
    };
    box.innerHTML = `<p class="lead center">${id === 'r1_ops' ? 'بوابة القلعة مغلقة بقفل من <b class="gold">' + d.answer.length + ' أقراص</b>. فتّشي الغرفة بحثًا عن اللفائف المخبّأة، ثم أديري الأقراص على الأرقام الصحيحة واسحبي الذراع.' : 'خلف البوابة قفل ثانٍ: <b class="gold">قفل التركيب</b> برقمين. اللفائف مخبأة مرة أخرى!'}</p>
      <div class="hotspots" style="grid-template-columns:repeat(${items.length},1fr)"></div><div class="clues"></div>
      <div class="vault"></div><div class="actions"><button class="btn lever">🔓 اسحبي الذراع</button></div><div class="feedback"></div>`;
    const hs = box.querySelector('.hotspots'), cl = box.querySelector('.clues'), vault = box.querySelector('.vault'), fbEl = box.querySelector('.feedback');
    items.forEach((ic, i) => {
      const b = h('<button class="hot ' + (ui.found.includes(i) ? 'found' : '') + '">' + ic + '<small>' + (ui.found.includes(i) ? 'وُجدت' : 'فتّشي') + '</small></button>');
      b.onclick = () => { if (ui.found.includes(i)) return; ui.found.push(i); saveLocal(); SFX.magic(); b.classList.add('found'); b.querySelector('small').textContent = 'وُجدت'; addClue(i); const r = b.getBoundingClientRect(); fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, '✨'); };
      hs.appendChild(b);
    });
    function addClue(i) { const c = h('<div class="parch clue" data-i="' + i + '"></div>'); c.innerHTML = clueHtml(i); const after = [...cl.children].find(x => +x.dataset.i > i); cl.insertBefore(c, after || null); }
    ui.found.slice().sort().forEach(addClue);
    const dialEls = d.answer.map((_, i) => {
      const el = h('<div class="dial"><span class="lbl">' + N[i] + '</span><button aria-label="أعلى">▲</button><div class="drum"><span class="digit">' + ui.dials[i] + '</span></div><button aria-label="أسفل">▼</button></div>');
      const drum = el.querySelector('.drum');
      const set = (v) => { ui.dials[i] = (v + 10) % 10; drum.querySelector('.digit').textContent = ui.dials[i]; drum.classList.remove('roll'); void drum.offsetWidth; drum.classList.add('roll'); SFX.roll(); el.classList.remove('right'); saveLocal(); };
      el.querySelectorAll('button')[0].onclick = () => set(ui.dials[i] + 1);
      el.querySelectorAll('button')[1].onclick = () => set(ui.dials[i] - 1);
      let sy = null; drum.addEventListener('pointerdown', e => { sy = e.clientY; drum.setPointerCapture(e.pointerId); });
      drum.addEventListener('pointermove', e => { if (sy === null) return; const dy = e.clientY - sy; if (Math.abs(dy) > 22) { set(ui.dials[i] + (dy < 0 ? 1 : -1)); sy = e.clientY; } });
      drum.addEventListener('pointerup', () => { sy = null; });
      drum.addEventListener('wheel', e => { e.preventDefault(); set(ui.dials[i] + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
      vault.appendChild(el); return el;
    });
    const lever = box.querySelector('.lever');
    lever.onclick = async () => {
      if (ui.found.length < items.length) { fb(fbEl, 'لم تجدي كل اللفائف بعد! فتّشي الغرفة (' + ui.found.length + '/' + items.length + ')', 'info'); shake(hs); SFX.bad(); return; }
      lever.disabled = true; SFX.click();
      const res = await submit(id, ui.dials.slice());
      lever.disabled = false;
      if (res.ok) { fb(fbEl, '🔓 انفتح القفل!', 'good'); SFX.unlock(); vault.style.transition = 'transform 1.2s'; vault.style.transform = 'rotate(-180deg) scale(.6)'; setTimeout(() => done(id), 900); return; }
      SFX.bad(); shake(vault);
      const f = res.fb || {};
      const w = me.wrong[id] || 0;
      let msg = '🔒 القفل لم ينفتح… ' + (f.right != null ? '<b>' + f.right + '</b> من ' + f.total + ' أقراص صحيحة في مكانها.' : '');
      if (w >= 3 && f.mask) { f.mask.forEach((ok, i) => dialEls[i].classList.toggle('right', ok)); msg += '<br>✨ الأقراص الصحيحة تتوهّج الآن بالأخضر.'; }
      else if (w === 2) msg += '<br>المصباح 🏮 في الأعلى قد يساعدك.';
      fb(fbEl, msg, 'bad');
    };
  }

  // ===== الغرفة 2: شبكة إحداثيات =====
  function gridSvg(R, extra, over) {
    const pad = 30, size = 480, unit = (size - 2 * pad) / (2 * R);
    const X = x => pad + (x + R) * unit, Y = y => pad + (R - y) * unit;
    let g = '';
    for (let i = -R; i <= R; i++) {
      g += `<line x1="${X(i)}" y1="${Y(-R)}" x2="${X(i)}" y2="${Y(R)}" stroke="${i === 0 ? '#cbd5e1' : '#334155'}" stroke-width="${i === 0 ? 2 : 1}"/>`;
      g += `<line x1="${X(-R)}" y1="${Y(i)}" x2="${X(R)}" y2="${Y(i)}" stroke="${i === 0 ? '#cbd5e1' : '#334155'}" stroke-width="${i === 0 ? 2 : 1}"/>`;
      if (i !== 0) { g += `<text x="${X(i)}" y="${Y(0) + 15}" font-size="11" fill="#94a3b8" text-anchor="middle">${i}</text><text x="${X(0) - 8}" y="${Y(i) + 4}" font-size="11" fill="#94a3b8" text-anchor="end">${i}</text>`; }
    }
    const svg = `<svg class="grid-svg" style="direction:ltr" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="mirrorGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a5f3fc"/><stop offset=".5" stop-color="#e0e7ff"/><stop offset="1" stop-color="#a5f3fc"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${g}<text x="${X(R) - 4}" y="${Y(0) - 6}" fill="#e2e8f0" font-size="14" text-anchor="end">x</text><text x="${X(0) + 6}" y="${Y(R) + 12}" fill="#e2e8f0" font-size="14">y</text>
      <line class="mirror-line" x1="${X(-R)}" y1="${Y(-R)}" x2="${X(R)}" y2="${Y(R)}"/><line class="mirror-shine" x1="${X(-R)}" y1="${Y(-R)}" x2="${X(R)}" y2="${Y(R)}"/>
      <text x="${X(R) - 40}" y="${Y(R) + 30}" fill="#a5f3fc" font-size="15" font-weight="bold">y = x 🪞</text>
      <g class="layer-under">${extra || ''}</g><g class="layer"></g><g class="layer-over" pointer-events="none">${over || ''}</g><g class="hits"></g></svg>`;
    return { svg, X, Y, unit, R };
  }
  function addHits(svgEl, G, onTap) {
    const hits = svgEl.querySelector('.hits');
    for (let x = -G.R; x <= G.R; x++) for (let y = -G.R; y <= G.R; y++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', G.X(x)); c.setAttribute('cy', G.Y(y)); c.setAttribute('r', G.unit * 0.45); c.setAttribute('class', 'cell-hit');
      c.addEventListener('click', () => onTap(x, y)); hits.appendChild(c);
    }
  }
  const gemPath = (cx, cy, s, fill, cls) => `<g class="${cls || ''}"><polygon points="${cx},${cy - s} ${cx + s * .8},${cy} ${cx},${cy + s} ${cx - s * .8},${cy}" fill="${fill}" stroke="#fff" stroke-width="1.5" filter="url(#glow)"/><polygon points="${cx},${cy - s} ${cx + s * .3},${cy} ${cx},${cy + s * .4} ${cx - s * .3},${cy}" fill="rgba(255,255,255,.35)"/></g>`;

  // قرص أرقام صغير قابل لإعادة الاستخدام
  function miniDial(value, onSet, lbl) {
    const el = h('<div class="dial">' + (lbl ? '<span class="lbl">' + lbl + '</span>' : '') + '<button aria-label="أعلى">▲</button><div class="drum"><span class="digit">' + value + '</span></div><button aria-label="أسفل">▼</button></div>');
    const drum = el.querySelector('.drum'); let v = value;
    const set = (nv) => { v = (nv + 10) % 10; drum.querySelector('.digit').textContent = v; drum.classList.remove('roll'); void drum.offsetWidth; drum.classList.add('roll'); SFX.roll(); el.classList.remove('right'); onSet(v); };
    el.querySelectorAll('button')[0].onclick = () => set(v + 1);
    el.querySelectorAll('button')[1].onclick = () => set(v - 1);
    let sy = null; drum.addEventListener('pointerdown', e => { sy = e.clientY; drum.setPointerCapture(e.pointerId); });
    drum.addEventListener('pointermove', e => { if (sy === null) return; const dy = e.clientY - sy; if (Math.abs(dy) > 22) { set(v + (dy < 0 ? 1 : -1)); sy = e.clientY; } });
    drum.addEventListener('pointerup', () => { sy = null; });
    return el;
  }

  // ===== الغرفة 2-أ: مرآة الأزواج (بدون رسم) =====
  function pointsPuzzle(box, id, done) {
    const d = P.generate(id, me.seed);
    const NP = d.points.length;
    const ui = local.ui[id] = local.ui[id] || {};
    if (!Array.isArray(ui.pairs) || ui.pairs.length !== NP) ui.pairs = d.points.map(() => [0, 0]);
    const rel = d.points.map(p => '(' + n(p[0]) + ', ' + n(p[1]) + ')').join(' , ');
    box.innerHTML = `<p class="lead center">في قاعة المرايا ${NP} بلّورات سحرية تمثّل العلاقة:<br>${M('R = { ' + rel + ' }')}<br>أمام كل بلّورة مرآة. أديري الأقراص في كل مرآة لتكتبي الزوج المقابل في <b class="gold">العلاقة العكسية</b> ${M('R<sup>−1</sup>')}، ثم أطلقي الضوء.</p>
      <div class="mirrors"></div><div class="actions"><button class="btn go">🪞 أطلقي ضوء المرآة</button></div><div class="feedback"></div>`;
    const wrap = box.querySelector('.mirrors'), fbEl = box.querySelector('.feedback');
    const rows = d.points.map(([a, b], i) => {
      const row = h(`<div class="mrow"><div class="crystal">${M('(' + a + ', ' + b + ')')}</div><div class="mglass">🪞</div><div class="mslot"><span class="par">(</span><span class="dl"></span><span class="par">,</span><span class="dl"></span><span class="par">)</span></div></div>`);
      const dls = row.querySelectorAll('.dl');
      [0, 1].forEach(j => dls[j].appendChild(miniDial(ui.pairs[i][j], v => { ui.pairs[i][j] = v; row.classList.remove('ok'); saveLocal(); })));
      wrap.appendChild(row); return row;
    });
    const go = box.querySelector('.go');
    go.onclick = async () => {
      go.disabled = true; const res = await submit(id, ui.pairs.map(p => p.slice())); go.disabled = false;
      if (res.ok) { rows.forEach(r => r.classList.add('ok')); fb(fbEl, '✨ انعكس الضوء تمامًا! كل زوج (a, b) أصبح (b, a).', 'good'); SFX.magic(); setTimeout(() => done(id), 1500); return; }
      SFX.bad(); shake(wrap);
      const f = res.fb || {};
      if ((me.wrong[id] || 0) >= 2 && f.mask) f.mask.forEach((ok, i) => rows[i].classList.toggle('ok', ok));
      fb(fbEl, 'الضوء تشتّت… <b>' + (f.good ?? '?') + '</b> من ' + NP + ' أزواج صحيحة.' + ((me.wrong[id] || 0) >= 2 ? '<br>✨ الأزواج الصحيحة تتوهج بالأخضر.' : ''), 'bad');
    };
  }

  // ===== الغرفة 2-ب: جدول الدالة والمرآة (بدون رسم) =====
  function linePuzzle(box, id, done) {
    const d = P.generate(id, me.seed);
    const ui = local.ui[id] = local.ui[id] || {};
    if (!Array.isArray(ui.vals) || ui.vals.length !== d.asks.length) ui.vals = d.asks.map(() => 0);
    const head = d.xs.map(x => '<td>' + x + '</td>').join(''), body = d.ys.map(y => '<td>' + y + '</td>').join('');
    box.innerHTML = `<p class="lead center">على جدار القاعة لوح سحري يُظهر قيم الدالة ${M('f')}. الباب السرّي يُفتح بقيمتين من <b class="gold">الدالة العكسية</b> ${M(F.INV)}.</p>
      <table class="ftable" dir="ltr"><tr><th>x</th>${head}</tr><tr><th>f(x)</th>${body}</tr></table>
      <div class="vault asks"></div><div class="actions"><button class="btn lever">🔓 افتحي الباب السري</button></div><div class="feedback"></div>`;
    const vault = box.querySelector('.asks'), fbEl = box.querySelector('.feedback');
    const dials = d.asks.map((v, i) => { const el = miniDial(ui.vals[i], nv => { ui.vals[i] = nv; saveLocal(); }, '<span class="m" dir="ltr">' + F.INV + '(' + v + ')</span>'); vault.appendChild(el); return el; });
    const lever = box.querySelector('.lever');
    lever.onclick = async () => {
      lever.disabled = true; const res = await submit(id, ui.vals.slice()); lever.disabled = false;
      if (res.ok) { fb(fbEl, '🔓 انفتح الباب السري!', 'good'); SFX.unlock(); setTimeout(() => done(id), 1200); return; }
      SFX.bad(); shake(vault);
      const f = res.fb || {};
      if (f.mask) f.mask.forEach((ok, i) => dials[i].classList.toggle('right', ok && (me.wrong[id] || 0) >= 2));
      fb(fbEl, 'الباب لم ينفتح… <b>' + (f.right ?? '?') + '</b> من ' + d.asks.length + ' صحيحة. تذكّري: ' + M(F.INV + '(b) = a') + ' تعني ' + M('f(a) = b') + '.', 'bad');
    };
  }

  // ===== الغرفة 3: آلات التركيب =====
  function machinePuzzle(box, id, done) {
    const d = P.generate(id, me.seed);
    const ui = local.ui[id] = local.ui[id] || { slots: Array(d.slots).fill(null) };
    const colors = { A: '#16a34a', B: '#2563eb', C: '#c026d3', D: '#ea580c' };
    const labels = Object.fromEntries(d.tiles.map(t => [t.id, t.label]));
    const intro = id === 'r3_m1' ? 'ضعي في كل آلة قارورة (اسحبيها، أو اضغطيها ثم اضغطي الآلة)، ثم اضغطي «شغّلي الآلة» حتى تصنعي الإكسير المطلوب.' : 'إكسير جديد! انتبهي لترتيب الآلات.';
    box.innerHTML = `<p class="lead center">${intro}</p><div class="target">الإكسير المطلوب: ${M('h(x) = ' + d.target)}</div>
      <div class="lab"><div class="shelf"></div><div class="pipeline"></div></div>
      <div class="actions"><button class="btn go">⚙️ شغّلي الآلة</button><button class="btn ghost small clr">إفراغ الآلات</button></div><div class="feedback"></div>`;
    const shelf = box.querySelector('.shelf'), pipe = box.querySelector('.pipeline'), fbEl = box.querySelector('.feedback');
    let selected = null;
    d.tiles.forEach(t => {
      const p = h('<div class="potion" style="--pc:' + colors[t.id] + '" data-id="' + t.id + '"><span class="m">' + t.label + '</span><span class="bub" style="left:30%"></span><span class="bub" style="left:60%;animation-delay:.8s"></span></div>');
      p.addEventListener('pointerdown', e => startDrag(e, p, t.id));
      shelf.appendChild(p);
    });
    let html = '<div class="node-x">x</div>';
    for (let i = 0; i < d.slots; i++) html += '<div class="pipe"><div class="flow"></div></div><div class="machine" data-i="' + i + '"><span class="no">' + (i + 1) + '</span><span class="content"></span><span class="val"></span></div>';
    html += '<div class="pipe"><div class="flow"></div></div><div class="node-h">h(x)</div>';
    pipe.innerHTML = html;
    const machines = [...pipe.querySelectorAll('.machine')];
    function draw() {
      machines.forEach((m, i) => { const v = ui.slots[i]; m.classList.toggle('filled', !!v); m.style.background = v ? 'radial-gradient(circle,' + colors[v] + '66, #1e163a)' : ''; m.querySelector('.content').innerHTML = v ? '<span class="m">' + labels[v] + '</span>' : '<span class="muted">فارغة</span>'; m.querySelector('.val').classList.remove('show'); });
      saveLocal();
    }
    function put(i, tid) { ui.slots[i] = tid; SFX.place(); draw(); machines[i].classList.add('glow'); setTimeout(() => machines[i].classList.remove('glow'), 500); }
    machines.forEach((m, i) => m.addEventListener('click', () => { if (selected) { put(i, selected); clearSel(); } else if (ui.slots[i]) { ui.slots[i] = null; SFX.click(); draw(); } }));
    function clearSel() { selected = null; shelf.querySelectorAll('.potion').forEach(x => x.classList.remove('sel')); }
    function startDrag(e, el, tid) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY; let ghost = null, over = null, moved = false;
      const move = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        if (!moved) { moved = true; ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost); }
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
        const t = document.elementFromPoint(ev.clientX, ev.clientY); const m = t && t.closest('.machine');
        if (over && over !== m) over.classList.remove('over'); over = m; if (m) m.classList.add('over');
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        if (ghost) ghost.remove();
        if (moved) { if (over) { over.classList.remove('over'); put(+over.dataset.i, tid); } }
        else { const was = selected === tid; clearSel(); if (!was) { selected = tid; el.classList.add('sel'); SFX.click(); } }
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    }
    draw();
    box.querySelector('.clr').onclick = () => { ui.slots = Array(d.slots).fill(null); draw(); };
    const go = box.querySelector('.go');
    go.onclick = async () => {
      if (ui.slots.some(s => !s)) { fb(fbEl, 'املئي كل الآلات أولًا.', 'info'); return; }
      go.disabled = true; pipe.classList.add('running');
      // عرض مرور x = 1 عبر الآلات
      let v = 1; pipe.querySelector('.node-x').textContent = '1';
      for (let i = 0; i < d.slots; i++) { await wait(550); v = P.tileFn(d, ui.slots[i])(v); const ve = machines[i].querySelector('.val'); ve.textContent = n(v); ve.classList.add('show'); machines[i].classList.add('glow'); SFX.tick(); setTimeout(() => machines[i].classList.remove('glow'), 500); }
      await wait(500);
      const res = await submit(id, ui.slots.slice());
      pipe.classList.remove('running'); go.disabled = false;
      const want1 = P.machineEval(d, d.answer, 1);
      if (res.ok) { pipe.querySelector('.node-h').textContent = 'h(1) = ' + n(want1) + ' ✓'; fb(fbEl, '🧪 الإكسير مطابق تمامًا!', 'good'); SFX.magic(); setTimeout(() => done(id), 1300); return; }
      SFX.bad(); shake(pipe);
      const f = res.fb || {};
      fb(fbEl, 'الإكسير فسد! 💨 عند ' + M('x = 1') + ' آلتك أنتجت ' + M(n(v)) + ' بينما ' + M('h(1) = ' + n(want1)) + (f.got2 != null ? '<br>وعند ' + M('x = 2') + ': آلتك ' + M(n(f.got2)) + ' والمطلوب ' + M(n(f.want2)) : ''), 'bad');
      setTimeout(() => { pipe.querySelector('.node-x').textContent = 'x'; }, 2500);
    };
  }

  // ===== الغرفة 4: المطابقة =====
  function matchPuzzle(box, id, done) {
    const d = P.generate(id, me.seed);
    const ui = local.ui[id] = local.ui[id] || { links: {} };
    const AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز'];
    box.innerHTML = `<p class="lead center">في السرداب ${d.funcs.length} <b style="color:#c4b5fd">أرواح</b> (دوال)، ولكل روح <b class="gold">ظلٌّ</b> واحد هو دالتها العكسية — وبين الظلال ظلٌّ مزيّف! اضغطي روحًا ثم ظلّها لربطهما. استخدمي «مِسبار الأرواح» لاختبار أي رابط.</p>
      <div class="crypt"><svg class="links"></svg><div class="col left"></div><div class="col right"></div></div>
      <div class="probe parch"><b>🔮 مِسبار الأرواح:</b> اختاري روحًا مربوطة، ثم أدخلي عددًا ${M('a')} لتري ${M('g(f(a))')}:
        <div class="row" style="justify-content:center;margin-top:8px"><input type="number" class="pin" value="2" step="any"><button class="btn small pgo">اختبري</button></div><div class="chain"></div></div>
      <div class="actions"><button class="btn go">⚡ أطلقي الطاقة</button></div><div class="feedback"></div>`;
    const L = box.querySelector('.left'), Rt = box.querySelector('.right'), svg = box.querySelector('svg.links'), crypt = box.querySelector('.crypt'), fbEl = box.querySelector('.feedback');
    let sel = null; let showOk = (me.wrong[id] || 0) >= 2;
    const lEls = d.funcs.map((f, i) => { const e = h('<button class="rune"><span class="tag">روح ' + (i + 1) + '</span><span class="m">f(x) = ' + f.tex + '</span></button>'); e.onclick = () => { sel = sel === f.key ? null : f.key; SFX.click(); draw(); }; L.appendChild(e); return e; });
    const rEls = d.cands.map((c, i) => { const e = h('<button class="rune"><span class="tag">ظل ' + AR[i] + '</span><span class="m">' + c.tex + '</span></button>'); e.onclick = () => { if (!sel) { fb(fbEl, 'اختاري روحًا من العمود الأيسر أولًا.', 'info'); return; } for (const k in ui.links) if (ui.links[k] === i) delete ui.links[k]; ui.links[sel] = i; SFX.place(); draw(); }; Rt.appendChild(e); return e; });
    function draw() {
      saveLocal();
      lEls.forEach((e, i) => { const k = d.funcs[i].key; e.classList.toggle('sel', sel === k); e.classList.toggle('linked', ui.links[k] != null); e.classList.toggle('ok', showOk && ui.links[k] != null && P.isInversePair(d.funcs[i].ev, d.cands[ui.links[k]].ev)); });
      const used = new Map(Object.entries(ui.links).map(([k, ri]) => [ri, d.funcs.findIndex(f => f.key === k) + 1]));
      rEls.forEach((e, i) => { e.classList.toggle('linked', used.has(i)); let b = e.querySelector('.lk'); if (used.has(i)) { if (!b) { b = h('<span class="lk"></span>'); e.appendChild(b); } b.textContent = '⟵ روح ' + used.get(i); } else if (b) b.remove(); });
      lEls.forEach((e, i) => { const k = d.funcs[i].key; let b = e.querySelector('.lk'); if (ui.links[k] != null) { if (!b) { b = h('<span class="lk"></span>'); e.appendChild(b); } b.textContent = 'ظل ' + AR[ui.links[k]] + ' ⟶'; } else if (b) b.remove(); });
      const cb = crypt.getBoundingClientRect();
      svg.innerHTML = '<defs><filter id="lg"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' + Object.entries(ui.links).map(([k, ri]) => {
        const li = d.funcs.findIndex(f => f.key === k); const a = lEls[li].getBoundingClientRect(), b = rEls[ri].getBoundingClientRect();
        const x1 = a.right - cb.left, y1 = a.top + a.height / 2 - cb.top, x2 = b.left - cb.left, y2 = b.top + b.height / 2 - cb.top, mx = (x1 + x2) / 2;
        const ok = showOk && P.isInversePair(d.funcs[li].ev, d.cands[ri].ev);
        return `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="${ok ? '#22c55e' : sel === k ? '#f5c451' : '#a78bfa'}" stroke-width="4" fill="none" filter="url(#lg)" class="beam"/>`;
      }).join('');
    }
    draw(); addEventListener('resize', draw);
    const fmt = v => Number.isFinite(v) ? (Math.abs(v - Math.round(v)) < 1e-9 ? n(Math.round(v)) : n(Math.round(v * 1000) / 1000)) : '؟';
    box.querySelector('.pgo').onclick = () => {
      const ch = box.querySelector('.chain');
      if (!sel || ui.links[sel] == null) { ch.innerHTML = '<span class="muted">اختاري روحًا مربوطة بظل أولًا.</span>'; return; }
      const a = parseFloat(box.querySelector('.pin').value); if (!Number.isFinite(a)) return;
      const f = d.funcs.find(x => x.key === sel), g = d.cands[ui.links[sel]];
      const fa = f.ev(a), gfa = g.ev(fa); const ok = Math.abs(gfa - a) < 1e-9;
      SFX.zap();
      ch.innerHTML = M(fmt(a) + ' →<sup>f</sup> ' + fmt(fa) + ' →<sup>g</sup> ' + fmt(gfa)) + ' &nbsp; ' + (ok ? '<b style="color:#15803d">✓ عاد العدد إلى نفسه</b>' : '<b style="color:#b91c1c">✗ لم يعد إلى ' + fmt(a) + '</b>');
    };
    const go = box.querySelector('.go');
    go.onclick = async () => {
      if (Object.keys(ui.links).length < d.funcs.length) { fb(fbEl, 'اربطي كل الأرواح (' + Object.keys(ui.links).length + '/' + d.funcs.length + ').', 'info'); return; }
      go.disabled = true; const res = await submit(id, ui.links); go.disabled = false;
      if (res.ok) { showOk = true; draw(); fb(fbEl, '🔮 اتحدت كل روح بظلها! انفتح باب السرداب.', 'good'); SFX.magic(); setTimeout(() => done(id), 1500); return; }
      SFX.bad(); shake(crypt);
      const f = res.fb || {};
      if ((me.wrong[id] || 0) >= 2) showOk = true;
      draw();
      fb(fbEl, 'ارتدّت الطاقة! <b>' + (f.good ?? '?') + '</b> من ' + d.funcs.length + ' روابط صحيحة.' + (showOk ? '<br>✨ الروابط الصحيحة تتوهج الآن بالأخضر.' : ''), 'bad');
    };
  }

  // ===== الغرفة 5: القنبلة =====
  let bombTimer = null;
  function bombPuzzle(box, _id, roomDoneCb) {
    const variant = me.bombVariant || 0;
    local.bomb = local.bomb && local.bomb.v === variant ? local.bomb : { v: variant, start: Date.now(), pen: 0, cuts: [], key: '', fin: '' };
    saveLocal();
    const B = local.bomb;
    const dw = P.generate('r5_wires', me.seed, variant), dk = P.generate('r5_key', me.seed, variant);
    box.innerHTML = `<p class="lead center">الكنز محميّ بقنبلة سحرية! عطّلي <b>الوحدتين</b> قبل أن ينتهي الوقت. الأخطاء تُنقص من الوقت.</p>
      <div class="bomb"><div class="center"><div class="timer">08:00</div></div><div class="modules">
        <div class="module" data-m="r5_wires"><h3><span class="led"></span> ① أسلاك الخط الأفقي <button class="iconbtn hb" style="margin-inline-start:auto;width:32px;height:32px">🏮</button></h3>
          <p style="margin:4px 0 8px;font-size:.95rem">اقطعي كل سلك يتصل بمنحنى دالة <b>ليس لها دالة عكسية</b>.</p><div class="wires"></div>
          <div class="ruler-wrap">📏 المسطرة الأفقية <input type="range" min="-4.8" max="4.8" step="0.1" value="1" class="ruler"></div></div>
        <div class="module" data-m="r5_key"><h3><span class="led"></span> ② لوحة المعكوس <button class="iconbtn hb" style="margin-inline-start:auto;width:32px;height:32px">🏮</button></h3>
          <p style="margin:4px 0">${M('f(x) = ' + dk.f)}</p><p style="margin:4px 0 8px">أدخلي قيمة ${M(F.INV + '(' + n(dk.v) + ')')}</p><div class="lcd" data-for="key"></div><div class="keypad" data-for="key"></div></div>
      </div><div class="feedback"></div></div>`;
    const fbEl = box.querySelector('.feedback'), timerEl = box.querySelector('.timer');
    box.querySelectorAll('.module').forEach(m => { m.querySelector('.hb').onclick = () => openHints(m.dataset.m); });
    function markDone() { box.querySelectorAll('.module').forEach(m => m.classList.toggle('done', solved(m.dataset.m))); }
    markDone();
    // الأسلاك
    const wiresEl = box.querySelector('.wires');
    const GW = 110, GH = 70, sx = x => (x + 4.5) / 9 * GW, sy = y => GH / 2 - y / 10.5 * GH;
    dw.wires.forEach((w, i) => {
      const f = P.wireFn(w); let pts = [];
      for (let x = -4.5; x <= 4.5; x += 0.05) { const y = f(x); if (Number.isFinite(y) && Math.abs(y) < 5.4) pts.push(sx(x).toFixed(1) + ',' + sy(y).toFixed(1)); else if (pts.length && pts[pts.length - 1] !== '|') pts.push('|'); }
      const polys = pts.join(' ').split('|').map(s => s.trim()).filter(Boolean).map(s => `<polyline points="${s}" fill="none" stroke="${w.color}" stroke-width="2.5"/>`).join('');
      const el = h(`<div class="wire ${B.cuts.includes(i) || (solved('r5_wires') && dw.answer.includes(i)) ? 'cut' : ''}" style="--wc:${w.color}"><div class="cable" style="background:${w.color}"></div><div class="gbox"><svg style="direction:ltr" viewBox="0 0 ${GW} ${GH}"><line x1="0" y1="${GH / 2}" x2="${GW}" y2="${GH / 2}" stroke="#334155"/><line x1="${sx(0)}" y1="0" x2="${sx(0)}" y2="${GH}" stroke="#334155"/>${polys}<line class="rl" x1="0" x2="${GW}" stroke="#f5c451" stroke-width="1.6" stroke-dasharray="4 3"/></svg><div class="gtex">${M('y = ' + w.tex)}</div></div></div>`);
      el.querySelector('.cable').onclick = async () => {
        if (solved('r5_wires') || B.cuts.includes(i)) return;
        B.cuts.push(i); el.classList.add('cut'); SFX.zap(); saveLocal();
        const res = await submit('r5_wires', B.cuts.slice());
        if (res.stale) return renderRoom(5);
        if (res.ok) { SFX.good(); fb(fbEl, '✔️ وحدة الأسلاك عُطّلت!', 'good'); markDone(); check(); return; }
        if (res.partial) { SFX.unlock(); fb(fbEl, 'قطع صحيح! ✂️', 'good'); return; }
        B.cuts = B.cuts.filter(x => x !== i); B.pen += 30; saveLocal();
        setTimeout(() => el.classList.remove('cut'), 500); SFX.bad(); shake(el);
        fb(fbEl, '⚡ شرارة! هذا المنحنى يجتاز اختبار الخط الأفقي (دالة متباينة) فلها دالة عكسية. خسرتِ 30 ثانية.', 'bad');
      };
      wiresEl.appendChild(el);
    });
    const ruler = box.querySelector('.ruler');
    const setRuler = () => box.querySelectorAll('.rl').forEach(l => { const y = sy(parseFloat(ruler.value)); l.setAttribute('y1', y); l.setAttribute('y2', y); });
    ruler.oninput = setRuler; setRuler();
    // لوحات الأرقام
    function keypad(which, pid, d) {
      const lcd = box.querySelector('.lcd[data-for="' + which + '"]'), pad = box.querySelector('.keypad[data-for="' + which + '"]');
      const show = () => { lcd.textContent = solved(pid) ? '✔ ' + n(Number(me.answers[pid] ? me.answers[pid].a : '')) : (B[which] || '_').replace('-', '−'); };
      ['7', '8', '9', '⌫', '4', '5', '6', '±', '1', '2', '3', '0'].forEach(k => {
        const b = h('<button>' + k + '</button>');
        b.onclick = () => { if (solved(pid)) return; SFX.beep(); let s = B[which] || ''; if (k === '⌫') s = s.slice(0, -1); else if (k === '±') s = s.startsWith('-') ? s.slice(1) : '-' + s; else if (s.replace('-', '').length < 4) s += k; B[which] = s; saveLocal(); show(); };
        pad.appendChild(b);
      });
      const ent = h('<button class="ent">إدخال ⏎</button>');
      ent.onclick = async () => {
        if (solved(pid)) return; const s = B[which] || ''; if (!s || s === '-') { shake(lcd); return; }
        ent.disabled = true; const res = await submit(pid, Number(s)); ent.disabled = false;
        if (res.stale) return renderRoom(5);
        if (res.ok) { SFX.good(); fb(fbEl, '✔️ ' + P.TITLES[pid] + ' عُطّلت!', 'good'); markDone(); show(); check(); return; }
        SFX.bad(); shake(lcd); B.pen += 15; B[which] = ''; saveLocal(); show();
        const f = res.fb || {};
        if (pid === 'r5_key') fb(fbEl, 'خطأ (−15 ثانية): إذا كانت ' + M(F.INV + '(' + n(d.v) + ') = ' + n(f.tried)) + ' فيجب أن تكون ' + M('f(' + n(f.tried) + ') = ' + n(d.v)) + '، لكن ' + M('f(' + n(f.tried) + ') = ' + n(f.fOfTried)) + '.', 'bad');
        else fb(fbEl, 'خطأ (−15 ثانية): تحققي — ' + M('f(' + n(f.tried) + ') = ' + n(f.fOfTried)) + '. هل هذا يساوي ' + M('g(' + n(d.p) + ')') + '؟', 'bad');
      };
      pad.appendChild(ent); show();
    }
    keypad('key', 'r5_key', dk);
    // المؤقت
    clearInterval(bombTimer);
    let exploding = false;
    function remaining() { return Math.max(0, Math.ceil(BOMB_SECONDS - (Date.now() - B.start) / 1000 - B.pen)); }
    function tick() {
      if (!document.body.contains(timerEl)) { clearInterval(bombTimer); return; }
      if (P.BOMB.every(solved)) { clearInterval(bombTimer); return; }
      const r = remaining(); timerEl.textContent = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
      timerEl.classList.toggle('low', r <= 30);
      if (r <= 30 && r > 0) SFX.beep();
      if (r <= 0 && !exploding) { exploding = true; explode(); }
    }
    async function explode() {
      clearInterval(bombTimer);
      const bm = h('<div class="boom"><div>💥</div></div>'); document.body.appendChild(bm); SFX.boom();
      try { const r = await api('/api/explode', { pid: me.pid, variant }); if (r.player) setMe(r.player); }
      catch (e) { queue.push({ path: '/api/explode', body: { pid: me.pid, variant } }); saveQueue(); me.bombVariant = variant + 1; me.explosions = (me.explosions || 0) + 1; setMe(me); }
      await wait(2600); bm.remove();
      toast('💨 الساحر أعاد ضبط القنبلة بأرقام جديدة! الوحدات التي عطّلتِها بقيت معطّلة.', 'bad');
      renderRoom(5);
    }
    function check() { if (P.BOMB.every(solved)) { clearInterval(bombTimer); timerEl.classList.remove('low'); timerEl.style.color = '#22c55e'; timerEl.style.textShadow = '0 0 18px #22c55e'; SFX.unlock(); setTimeout(() => showKey(5), 1100); } }
    bombTimer = setInterval(tick, 1000); tick();
  }

  // ---------- الكنز ----------
  function renderTreasure(fresh) {
    setView('treasure'); hintFor = null;
    const mins = me.finishedAt ? Math.round((me.finishedAt - me.joinedAt) / 60000) : Math.round((Date.now() - me.joinedAt) / 60000);
    const w = h(`<div class="center" style="padding-top:20px"><div class="chest">💰</div>
      <h1 class="game-title">هربتِ من قلعة الدوال!</h1><p class="lead">أحسنتِ يا ${'<b class="gold nm"></b>'}! فككتِ كل الشفرات، وعكستِ المرايا، وركّبتِ الإكسير، وعطّلتِ القنبلة.</p>
      <div class="stats"><div class="stat"><b>${me.score}</b>النقاط</div><div class="stat"><b>${me.gems} 💎</b>الجواهر</div><div class="stat"><b>${mins}</b>دقيقة</div><div class="stat"><b>${me.totalHints}</b>تلميحات</div><div class="stat"><b>${me.totalWrong}</b>محاولات خاطئة</div></div>
      <div class="parch" style="text-align:right"><b>📜 خلاصة مغامرتك:</b><br>• ${M('(f ∘ g)(x) = f(g(x))')}: الداخلية أولًا.<br>• معكوس العلاقة: بدّلي ${M('(a, b) → (b, a)')}، والمنحنى ينعكس حول ${M('y = x')}.<br>• الدالة لها معكوس إذا اجتازت اختبار الخط الأفقي.<br>• f و g عكسيتان إذا كان ${M('f(g(x)) = g(f(x)) = x')}.</div>
      <div class="actions"><button class="btn ghost" id="mp">🗺️ الخريطة</button></div><p class="credit">إعداد: أ. نوف السبيعي</p></div>`);
    shell(w); w.querySelector('.nm').textContent = me.name;
    w.querySelector('#mp').onclick = () => renderMap();
    if (fresh) { SFX.fanfare(); fx.confetti(220); setTimeout(() => fx.confetti(160), 900); }
  }

  // ---------- البدء ----------
  document.addEventListener('pointerdown', () => SFX.unlockAudio(), { once: true });
  if (local.pid && local.name && local.cls) {
    app.innerHTML = '<div class="join"><div class="panel center"><h2 class="title gold">… جارٍ فتح بوابة القلعة</h2></div></div>';
    join(local.name, local.cls).then(ok => { if (!ok) renderJoin('تعذّر الاتصال. حاولي مرة أخرى.'); });
  } else renderJoin();
  window.__castle = { get me() { return me; }, renderRoom, renderMap };
})();
