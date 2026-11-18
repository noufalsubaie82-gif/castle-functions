/* غرفة مراقبة المعلمة — مزامنة لحظية حقيقية عبر Server-Sent Events */
(function () {
  'use strict';
  const P = window.CastlePuzzles;
  const app = document.getElementById('app');
  const KEY = 'castle_teacher_key';
  let key = null; try { key = localStorage.getItem(KEY); } catch (e) { }
  const players = new Map();
  let clsFilter = 'all', sortBy = 'rank', es = null, serverSkew = 0, soundOn = false;
  const ZONES = { 1: [30, 380, 300, 165], 2: [350, 380, 300, 165], 3: [670, 380, 300, 165], 4: [520, 200, 450, 160], 5: [30, 200, 470, 160], 6: [300, 22, 400, 158] };
  const ZNAME = r => r === 6 ? '👑 الكنز — هربن!' : P.ROOMS[r - 1].icon + ' ' + P.ROOMS[r - 1].name;

  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function toast(msg) { const t = h('<div class="toast"></div>'); t.innerHTML = msg; document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 3500); }
  const now = () => Date.now() + serverSkew;
  const online = p => now() - p.lastSeen < 35000;
  const rankSort = (a, b) => (b.solvedCount - a.solvedCount) || ((a.finishedAt || Infinity) - (b.finishedAt || Infinity)) || (b.score - a.score) || (a.joinedAt - b.joinedAt);
  const visible = () => [...players.values()].filter(p => clsFilter === 'all' || p.cls === clsFilter);
  const fmtDur = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  (function sky() { const c = document.getElementById('sky'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight; for (let i = 0; i < 140; i++) { x.globalAlpha = Math.random() * .8 + .2; x.fillStyle = '#fff'; x.beginPath(); x.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 1.3, 0, 7); x.fill(); } })();

  // ---------- الدخول ----------
  function renderLogin(err) {
    app.innerHTML = '';
    const el = h(`<div class="join"><div class="panel" style="width:min(420px,100%)"><h1 class="game-title" style="font-size:2.2rem">👁️ غرفة المراقبة</h1><p class="sub">لوحة المعلمة — قلعة الدوال</p>
      <label class="field"><span>كلمة المرور</span><input type="password" id="pw" autocomplete="current-password"></label><div class="err">${err || ''}</div>
      <button class="btn" id="go" style="width:100%">دخول</button></div></div>`);
    app.appendChild(el);
    const go = async () => {
      const r = await fetch('/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: el.querySelector('#pw').value }) }).then(r => r.json()).catch(() => ({ error: 'تعذّر الاتصال بالخادم' }));
      if (r.key) { key = r.key; try { localStorage.setItem(KEY, key); } catch (e) { } renderDash(); } else el.querySelector('.err').textContent = r.error || 'خطأ';
    };
    el.querySelector('#go').onclick = go; el.querySelector('#pw').addEventListener('keydown', e => e.key === 'Enter' && go());
    el.querySelector('#pw').focus();
  }

  // ---------- اللوحة ----------
  let mapBox, avLayer, feedEl, lbEl, tbody, statsEl, liveEl, clsSel;
  function renderDash() {
    app.innerHTML = '';
    const zones = Object.entries(ZONES).map(([r, [x, y, w, hh]]) => {
      r = +r; const info = r === 6 ? { name: 'الكنز — هربن من القلعة', icon: '👑' } : P.ROOMS[r - 1];
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="22" fill="${r === 6 ? 'rgba(245,196,81,.12)' : 'rgba(255,255,255,.04)'}" stroke="${r === 6 ? '#f5c451' : 'rgba(167,139,250,.45)'}" stroke-width="2.5" stroke-dasharray="${r === 6 ? '' : '8 6'}"/>
        <text x="${x + w - 14}" y="${y + 30}" text-anchor="end" font-size="22" font-weight="800" fill="#ffe8a3" font-family="Tajawal">${info.icon} ${info.name}</text>
        <text class="zc" data-r="${r}" x="${x + 16}" y="${y + 30}" font-size="22" font-weight="900" fill="#f5c451" font-family="Tajawal">0</text></g>`;
    }).join('');
    const c = r => { const [x, y, w, hh] = ZONES[r]; return [x + w / 2, y + hh / 2]; };
    const path = [1, 2, 3, 4, 5, 6].map((r, i) => (i ? 'L' : 'M') + c(r).join(' ')).join(' ');
    const el = h(`<div>
      <div class="tbar"><h1>👁️ غرفة المراقبة</h1><span class="live" id="live"><i></i><span>جارٍ الاتصال…</span></span>
        <span class="chip" id="stats"></span><span class="grow"></span>
        <select id="cls"><option value="all">كل الفصول</option></select>
        <button class="btn small ghost" id="link">🔗 رابط الطالبات</button>
        <button class="btn small ghost" id="board">🖥️ وضع السبورة</button>
        <button class="btn small ghost" id="snd">🔕 الصوت</button>
        <button class="btn small ghost" id="csv">⬇️ تصدير النتائج</button>
        <button class="btn small ghost" id="reset">🧹 جلسة جديدة</button>
        <button class="btn small ghost" id="out">خروج</button></div>
      <div class="main"><div>
        <div class="mapbox" id="mapbox"><svg class="bg" style="direction:ltr" viewBox="0 0 1000 570" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 570 V190 h30 v-22 h22 v22 h26 v-22 h22 v22 h190 V12 h30 v-20 h22 v20 h360 v-20 h22 v20 h30 V190 h190 v-22 h22 v22 h26 v-22 h22 v22 h30 V570z" fill="rgba(45,36,82,.55)" stroke="#3d3170" stroke-width="3"/>
          <path d="${path}" fill="none" stroke="#f5c451" stroke-opacity=".25" stroke-width="10" stroke-dasharray="3 16" stroke-linecap="round"/>
          ${zones}</svg><div class="avs" id="avs"></div><div class="empty-msg" id="empty">بانتظار دخول الطالبات…<br>اعرضي رابط الطالبات 🔗</div></div>
        <div class="legend" style="margin-top:8px"><span>الحلقة حول الشخصية = نسبة التقدم</span><span>👑 هربت</span><span>الشخصية الباهتة = غير متصلة الآن</span><span>اضغطي أي شخصية لتفاصيلها</span></div>
      </div>
      <div class="side"><div class="panel"><h3 class="title gold" style="font-size:1.4rem">🏆 الترتيب المباشر</h3><div id="lb"></div></div>
        <div class="panel"><h3 class="title gold" style="font-size:1.4rem">📣 ما يحدث الآن</h3><div class="feed" id="feed"></div></div></div></div>
      <div class="tablesec" style="padding:0 14px 30px"><div class="panel"><h3 class="title gold" style="font-size:1.4rem">📋 تقدّم كل طالبة</h3>
        <div class="legend" style="margin-bottom:8px"><span><i class="dot s"></i> محلول</span><span><i class="dot g"></i> محلول بجوهرة (بلا تلميح)</span><span><i class="dot c"></i> تعمل عليه الآن</span><span><i class="dot w"></i> تعمل عليه وأخطأت</span></div>
        <div class="tablewrap"><table><thead><tr><th data-s="rank">#</th><th data-s="name">الطالبة</th><th data-s="cls">الفصل</th><th data-s="room">الموقع الآن</th><th>الألغاز (${P.PUZZLES.length})</th><th data-s="score">⭐ النقاط</th><th>💎</th><th>🏮</th><th>✗</th><th>💥</th><th data-s="time">الوقت</th><th>الحالة</th></tr></thead><tbody id="tb"></tbody></table></div></div></div>
    </div>`);
    app.appendChild(el);
    mapBox = el.querySelector('#mapbox'); avLayer = el.querySelector('#avs'); feedEl = el.querySelector('#feed'); lbEl = el.querySelector('#lb'); tbody = el.querySelector('#tb'); statsEl = el.querySelector('#stats'); liveEl = el.querySelector('#live'); clsSel = el.querySelector('#cls');
    clsSel.onchange = () => { clsFilter = clsSel.value; renderAll(); };
    el.querySelectorAll('th[data-s]').forEach(th => th.onclick = () => { sortBy = th.dataset.s; renderTable(); });
    el.querySelector('#board').onclick = () => { document.body.classList.toggle('board'); if (document.body.classList.contains('board') && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); else if (document.fullscreenElement) document.exitFullscreen(); setTimeout(layoutAvatars, 400); };
    el.querySelector('#snd').onclick = e => { soundOn = !soundOn; e.target.textContent = soundOn ? '🔔 الصوت' : '🔕 الصوت'; if (soundOn) { SFX.unlockAudio(); if (SFX.muted) SFX.toggle(); SFX.good(); } };
    el.querySelector('#csv').onclick = () => { location.href = '/api/teacher/export.csv?key=' + encodeURIComponent(key); };
    el.querySelector('#out').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { } if (es) es.close(); renderLogin(); };
    el.querySelector('#link').onclick = showLink;
    el.querySelector('#reset').onclick = () => {
      const box = h(`<div><h2 class="title gold">🧹 بدء جلسة جديدة؟</h2><p class="lead">سيُحفظ نسخة من نتائج الجلسة الحالية داخل الخادم، ثم تُمسح اللوحة لتبدأ طالبات فصل جديد من الصفر.<br><b>ننصح بتصدير النتائج أولًا.</b></p><div class="actions"><button class="btn red" id="y">نعم، جلسة جديدة</button><button class="btn ghost" id="n">إلغاء</button></div></div>`);
      const bg = modal(box);
      box.querySelector('#n').onclick = () => bg.remove();
      box.querySelector('#y').onclick = async () => { await fetch('/api/teacher/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }); bg.remove(); toast('بدأت جلسة جديدة'); };
    };
    addEventListener('resize', layoutAvatars);
    connect();
    setInterval(() => { renderStats(); refreshOnline(); renderTable(); }, 5000);
  }
  function modal(inner) { const bg = h('<div class="modal-bg"><div class="modal panel"></div></div>'); bg.querySelector('.modal').append(inner); bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); }); document.body.appendChild(bg); return bg; }
  function showLink() {
    const url = location.origin + '/';
    const box = h(`<div class="center"><h2 class="title gold" style="font-size:2rem">🏰 ادخلن القلعة!</h2><p class="lead">افتحي الرابط من جوالك أو جهازك، واكتبي اسمك وفصلك فقط.</p><div class="link-big">${esc(url)}</div>
      <img alt="" style="width:min(300px,70vw);background:#fff;padding:10px;border-radius:14px" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(url)}" onerror="this.remove()">
      <div class="actions"><button class="btn ghost" id="cp">نسخ الرابط</button><button class="btn" id="cl">إغلاق</button></div></div>`);
    const bg = modal(box); box.querySelector('.modal') ; bg.querySelector('.modal').style.maxWidth = '760px';
    box.querySelector('#cl').onclick = () => bg.remove();
    box.querySelector('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast('نُسخ الرابط ✔️')); };
  }

  // ---------- الاتصال اللحظي ----------
  function connect() {
    if (es) es.close();
    es = new EventSource('/api/teacher/stream?key=' + encodeURIComponent(key));
    es.addEventListener('snapshot', e => { const d = JSON.parse(e.data); serverSkew = d.now - Date.now(); players.clear(); d.players.forEach(p => players.set(p.pid, p)); setLive(true); renderAll(); });
    es.addEventListener('player', e => { const p = JSON.parse(e.data); const prev = players.get(p.pid); players.set(p.pid, p); onChange(prev, p); setLive(true); });
    es.addEventListener('seen', e => { const d = JSON.parse(e.data); const p = players.get(d.pid); if (p) { const was = online(p); p.lastSeen = d.lastSeen; p.view = d.view; if (was !== online(p)) { refreshOnline(); renderStats(); } } });
    es.addEventListener('remove', e => { const d = JSON.parse(e.data); players.delete(d.pid); renderAll(); });
    es.onopen = () => setLive(true);
    es.onerror = async () => {
      setLive(false);
      const r = await fetch('/api/teacher/stream?key=' + encodeURIComponent(key), { method: 'GET' }).then(r => { const s = r.status; if (r.body) r.body.cancel().catch(() => { }); return s; }).catch(() => 0);
      if (r === 401) { es.close(); try { localStorage.removeItem(KEY); } catch (e) { } renderLogin('انتهت صلاحية الدخول، أعيدي كتابة كلمة المرور'); }
    };
  }
  function setLive(on) { if (!liveEl) return; liveEl.classList.toggle('on', on); liveEl.querySelector('span').textContent = on ? 'مباشر' : 'انقطع — إعادة الاتصال…'; }

  function feed(html) {
    if (!feedEl) return;
    const t = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const d = h('<div></div>'); d.innerHTML = html + '<time>' + t + '</time>'; feedEl.prepend(d);
    while (feedEl.children.length > 60) feedEl.lastChild.remove();
  }
  function onChange(prev, p) {
    const nm = '<b style="color:' + p.color + '">' + esc(p.name) + '</b>';
    if (!prev) { feed('🚪 ' + nm + ' دخلت القلعة (' + esc(p.cls) + ')'); renderAll(); return; }
    const newly = P.PUZZLES.filter(id => p.solved[id] && !prev.solved[id]);
    newly.forEach(id => { feed((p.solved[id].gem ? '💎 ' : '🔓 ') + nm + ' حلّت «' + P.TITLES[id] + '»'); popAt(p.pid, p.solved[id].gem ? '💎 +' : '✔ ' + P.TITLES[id]); });
    if (p.room !== prev.room) { if (p.room === 6) { feed('👑 ' + nm + ' هربت من القلعة بالكنز!'); if (soundOn) SFX.fanfare(); } else feed('➡️ ' + nm + ' انتقلت إلى ' + ZNAME(p.room)); }
    if (p.explosions > prev.explosions) feed('💥 انفجرت قنبلة ' + nm + ' — أُعيد ضبطها');
    if (p.totalHints > prev.totalHints) feed('🏮 ' + nm + ' أشعلت مصباح التلميح في «' + P.TITLES[p.current] + '»');
    if (newly.length && soundOn) SFX.gem();
    renderAll();
  }
  function popAt(pid, txt) {
    const a = avLayer && avLayer.querySelector('[data-pid="' + pid + '"]'); if (!a) return;
    const d = h('<div class="pop"></div>'); d.textContent = txt; d.style.left = (parseFloat(a.style.left) + a.offsetWidth / 2) + 'px'; d.style.top = (parseFloat(a.style.top) - 10) + 'px';
    avLayer.appendChild(d); setTimeout(() => d.remove(), 2000);
  }

  // ---------- الرسم ----------
  function renderAll() { refreshClasses(); renderStats(); layoutAvatars(); renderLB(); renderTable(); }
  function refreshClasses() {
    if (!clsSel) return;
    const set = [...new Set([...players.values()].map(p => p.cls))].sort();
    const cur = clsSel.value;
    clsSel.innerHTML = '<option value="all">كل الفصول (' + players.size + ')</option>' + set.map(c => '<option value="' + esc(c) + '">' + esc(c) + ' (' + [...players.values()].filter(p => p.cls === c).length + ')</option>').join('');
    clsSel.value = set.includes(cur) ? cur : 'all'; clsFilter = clsSel.value;
  }
  function renderStats() {
    if (!statsEl) return;
    const v = visible(); const on = v.filter(online).length, fin = v.filter(p => p.finishedAt).length;
    const avg = v.length ? Math.round(v.reduce((a, p) => a + p.solvedCount / p.total, 0) / v.length * 100) : 0;
    statsEl.innerHTML = '👩‍🎓 ' + v.length + ' &nbsp;|&nbsp; 🟢 متصلة ' + on + ' &nbsp;|&nbsp; 👑 هربت ' + fin + ' &nbsp;|&nbsp; 📈 متوسط التقدم ' + avg + '%';
    document.querySelectorAll('.zc').forEach(t => { t.textContent = v.filter(p => p.room === +t.dataset.r).length; });
    const em = document.getElementById('empty'); if (em) em.style.display = v.length ? 'none' : '';
  }
  function layoutAvatars() {
    if (!avLayer) return;
    const W = mapBox.clientWidth, s = W / 1000;
    const v = visible(); const byRoom = {};
    v.slice().sort((a, b) => a.joinedAt - b.joinedAt).forEach(p => (byRoom[p.room] = byRoom[p.room] || []).push(p));
    const seen = new Set();
    for (const [r, list] of Object.entries(byRoom)) {
      const [zx, zy, zw, zh] = ZONES[r]; const ix = zx + 10, iy = zy + 44, iw = zw - 20, ih = zh - 52;
      const N = list.length; let cols = Math.max(1, Math.ceil(Math.sqrt(N * iw / ih))); let rows = Math.ceil(N / cols);
      while ((iw / cols) < 34 && cols > 1) { cols--; rows = Math.ceil(N / cols); }
      const cw = iw / cols, ch = ih / rows; const cell = Math.min(cw, ch * 1.05, 92);
      const face = Math.max(18, cell * .56) * s, font = Math.max(9, Math.min(15, cell * .17)) * s;
      list.forEach((p, i) => {
        seen.add(p.pid);
        let a = avLayer.querySelector('[data-pid="' + p.pid + '"]');
        if (!a) { a = h('<div class="avt" data-pid="' + p.pid + '"><div class="face"><svg class="prog" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle class="pc" cx="20" cy="20" r="18" fill="none" stroke-width="3" stroke-linecap="round" transform="rotate(-90 20 20)" stroke-dasharray="113"/></svg><span class="em"></span></div><div class="nm"></div></div>'); a.onclick = () => details(p.pid); const [cx, cy] = [ZONES[1][0] + ZONES[1][2] / 2, ZONES[1][1] + ZONES[1][3] / 2]; a.style.left = cx * s + 'px'; a.style.top = cy * s + 'px'; avLayer.appendChild(a); void a.offsetWidth; }
        const col = i % cols, row = Math.floor(i / cols);
        const x = (ix + cw * col + cw / 2) * s - face / 2 - 6, y = (iy + ch * row + (ch - cell) / 2) * s;
        const oldRoom = a.dataset.room;
        if (oldRoom && oldRoom !== String(r)) { a.classList.add('walk'); setTimeout(() => a.classList.remove('walk'), 1500); }
        a.dataset.room = r;
        a.style.left = x + 'px'; a.style.top = y + 'px'; a.style.width = (face + 12) + 'px';
        const f = a.querySelector('.face'); f.style.width = f.style.height = face + 'px'; f.style.borderColor = p.color; f.style.fontSize = face * .55 + 'px';
        a.querySelector('.em').textContent = p.avatar;
        const pc = a.querySelector('.pc'); pc.setAttribute('stroke', p.finishedAt ? '#f5c451' : '#22c55e'); pc.setAttribute('stroke-dashoffset', 113 * (1 - p.solvedCount / p.total));
        const nm = a.querySelector('.nm'); nm.textContent = p.name.split(' ')[0]; nm.title = p.name; nm.style.fontSize = font + 'px'; nm.style.maxWidth = Math.max(cw * s, face + 12) + 'px';
        let cr = a.querySelector('.crown'); if (p.finishedAt && !cr) a.querySelector('.face').insertAdjacentHTML('beforeend', '<span class="crown">👑</span>'); if (!p.finishedAt && cr) cr.remove();
        a.classList.toggle('off', !online(p));
      });
    }
    avLayer.querySelectorAll('.avt').forEach(a => { if (!seen.has(a.dataset.pid)) a.remove(); });
  }
  function refreshOnline() { if (!avLayer) return; avLayer.querySelectorAll('.avt').forEach(a => { const p = players.get(a.dataset.pid); if (p) a.classList.toggle('off', !online(p)); }); }
  function renderLB() {
    if (!lbEl) return;
    const v = visible().sort(rankSort).slice(0, 10);
    const med = ['🥇', '🥈', '🥉'];
    lbEl.innerHTML = v.length ? v.map((p, i) => `<div class="lb-row"><span class="rk">${med[i] || i + 1}</span><span style="font-size:20px">${p.avatar}</span><span class="nm">${esc(p.name)}</span><span class="muted" style="font-size:.85rem">${p.solvedCount}/${p.total}</span><span class="sc">${p.score}</span></div>`).join('') : '<p class="muted">لا أحد بعد</p>';
  }
  function renderTable() {
    if (!tbody) return;
    let v = visible();
    const ranked = v.slice().sort(rankSort); const rank = new Map(ranked.map((p, i) => [p.pid, i + 1]));
    const sorters = { rank: rankSort, name: (a, b) => a.name.localeCompare(b.name, 'ar'), cls: (a, b) => a.cls.localeCompare(b.cls, 'ar') || rankSort(a, b), room: (a, b) => b.room - a.room || rankSort(a, b), score: (a, b) => b.score - a.score, time: (a, b) => ((a.finishedAt || now()) - a.joinedAt) - ((b.finishedAt || now()) - b.joinedAt) };
    v.sort(sorters[sortBy] || rankSort);
    tbody.innerHTML = v.map(p => {
      const dots = P.PUZZLES.map(id => { const s = p.solved[id]; const cls = s ? (s.gem ? 'g' : 's') : id === p.current ? ((p.wrong[id] || 0) > 0 ? 'w' : 'c') : ''; return '<i class="dot ' + cls + '" title="' + P.TITLES[id] + (s ? ' ✔' : (p.wrong[id] ? ' — أخطاء: ' + p.wrong[id] : '')) + '"></i>'; }).join('');
      const where = p.room === 6 ? '👑 هربت' : P.ROOMS[p.room - 1].icon + ' ' + (p.current ? P.TITLES[p.current] : '');
      const st = p.finishedAt ? '<span class="stchip fin">هربت</span>' : online(p) ? '<span class="stchip on">متصلة</span>' : '<span class="stchip off">غير متصلة</span>';
      return `<tr data-pid="${p.pid}"><td>${rank.get(p.pid)}</td><td class="nmc"><span style="font-size:18px">${p.avatar}</span> ${esc(p.name)}</td><td>${esc(p.cls)}</td><td>${where}</td><td><span class="dots">${dots}</span></td><td><b class="gold">${p.score}</b></td><td>${p.gems}</td><td>${p.totalHints}</td><td>${p.totalWrong}</td><td>${p.explosions}</td><td>${fmtDur((p.finishedAt || now()) - p.joinedAt)}</td><td>${st}</td></tr>`;
    }).join('') || '<tr><td colspan="12" class="muted">لا توجد طالبات بعد</td></tr>';
    tbody.querySelectorAll('tr[data-pid]').forEach(tr => tr.onclick = () => details(tr.dataset.pid));
  }
  function details(pid) {
    const p = players.get(pid); if (!p) return;
    const rows = P.PUZZLES.map(id => { const s = p.solved[id]; return `<tr><td style="text-align:right">${P.ROOMS[P.ROOM_OF[id] - 1].icon} ${P.TITLES[id]}</td><td>${s ? (s.gem ? '💎 ✔' : '✔') : id === p.current ? '⏳ الآن' : '—'}</td><td>${p.hints[id] || 0}</td><td>${p.wrong[id] || 0}</td><td>${s ? new Date(s.at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</td></tr>`; }).join('');
    const box = h(`<div><h2 class="title gold" style="font-size:1.8rem">${p.avatar} <span class="pn"></span></h2><p class="muted">${esc(p.cls)} — ${ZNAME(p.room)} — ⭐ ${p.score} — 💎 ${p.gems} — 💥 ${p.explosions}</p>
      <table><thead><tr><th>اللغز</th><th>الحالة</th><th>🏮</th><th>✗</th><th>الوقت</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="actions"><button class="btn ghost small" id="rm">حذف من اللوحة</button><button class="btn" id="cl">إغلاق</button></div></div>`);
    box.querySelector('.pn').textContent = p.name;
    const bg = modal(box);
    box.querySelector('#cl').onclick = () => bg.remove();
    box.querySelector('#rm').onclick = async () => { if (!confirm('حذف ' + p.name + ' من اللوحة؟')) return; await fetch('/api/teacher/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, pid }) }); bg.remove(); };
  }

  if (key) renderDash(); else renderLogin();
})();
