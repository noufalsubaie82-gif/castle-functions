// خادم «الهروب من قلعة الدوال» — Node.js بدون أي مكتبات خارجية
// - يقدّم صفحة الطالبات (/) وغرفة مراقبة المعلمة (/teacher)
// - يصحّح كل إجابة بنفسه من بذرة الطالبة (لا يثق بما يقوله المتصفح)
// - يبث التقدم لحظيًا إلى لوحة المعلمة عبر Server-Sent Events
// - يحفظ كل شيء في ملف JSON ويستعيد تقدم الطالبة من جهازها إذا أُعيد تشغيل الخادم
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('./puzzles.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'narjis2026';
const PUBLIC = __dirname;
const STATIC = new Set(['index.html', 'teacher.html', 'style.css', 'puzzles.js', 'audio.js', 'game.js', 'teacher.js']);

// ---------- الحالة والحفظ ----------
let db = { secret: crypto.randomBytes(24).toString('hex'), players: {}, archive: [], sessionStarted: Date.now(), session: crypto.randomBytes(6).toString('hex') };
// bootFresh: الخادم بدأ بلا ملف بيانات (مثلًا بعد إعادة تشغيل تمسح القرص في الاستضافة المجانية)
let bootFresh = true;
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); bootFresh = false; }
} catch (e) { console.error('تعذر قراءة ملف البيانات:', e.message); }

let saveTimer = null, saving = false, saveAgain = false;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(doSave, 300);
}
function doSave() {
  saveTimer = null;
  if (saving) { saveAgain = true; return; }
  saving = true;
  const tmp = DATA_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), err => {
    if (err) { saving = false; console.error('save', err.message); return; }
    fs.rename(tmp, DATA_FILE, () => { saving = false; if (saveAgain) { saveAgain = false; doSave(); } });
  });
}
function saveNowSync() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) { } }
process.on('SIGTERM', () => { saveNowSync(); process.exit(0); });
process.on('SIGINT', () => { saveNowSync(); process.exit(0); });

// المفتاح مشتق من كلمة المرور فقط، فيبقى صالحًا حتى لو مُسح القرص في الاستضافة المجانية
const TEACHER_KEY = crypto.createHmac('sha256', 'castle-of-functions-v1').update('teacher:' + TEACHER_PASSWORD).digest('hex').slice(0, 40);

// ---------- أدوات ----------
const AVATARS = ['🧙‍♀️', '🧝‍♀️', '🦸‍♀️', '👸', '🧚‍♀️', '🥷', '🧜‍♀️', '🦄', '🐉', '🦉', '🦊', '🐺', '🦁', '🐯', '🦅', '🐬'];
const COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#84cc16', '#0ea5e9'];
function normName(s) {
  return String(s || '').replace(/[ـً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
}
function clean(s, max) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function newId() { return crypto.randomBytes(9).toString('base64url'); }

function deriveRoom(p) {
  for (const r of [1, 2, 3, 4, 5]) {
    if (P.PUZZLES.some(id => P.ROOM_OF[id] === r && !p.solved[id])) return r;
  }
  return 6; // هربت ووصلت إلى الكنز
}
function currentPuzzle(p) { return P.PUZZLES.find(id => !p.solved[id]) || null; }
function scoreOf(p) {
  let s = 0;
  for (const id of P.PUZZLES) if (p.solved[id]) s += p.solved[id].score;
  s -= 20 * (p.explosions || 0);
  if (p.finishedAt) s += 100;
  return Math.max(0, s);
}
function publicView(p) {
  const solvedIds = P.PUZZLES.filter(id => p.solved[id]);
  const totalHints = Object.values(p.hints).reduce((a, b) => a + b, 0);
  const totalWrong = Object.values(p.wrong).reduce((a, b) => a + b, 0);
  return {
    pid: p.pid, name: p.name, cls: p.cls, avatar: p.avatar, color: p.color,
    room: deriveRoom(p), current: currentPuzzle(p), view: p.view || '',
    solved: Object.fromEntries(solvedIds.map(id => [id, { at: p.solved[id].at, hints: p.solved[id].hints, wrong: p.solved[id].wrong, gem: p.solved[id].gem }])),
    solvedCount: solvedIds.length, total: P.PUZZLES.length,
    hints: p.hints, wrong: p.wrong, totalHints, totalWrong,
    gems: solvedIds.filter(id => p.solved[id].gem).length,
    explosions: p.explosions || 0, bombVariant: p.bombVariant || 0,
    score: scoreOf(p), joinedAt: p.joinedAt, finishedAt: p.finishedAt || null, lastSeen: p.lastSeen
  };
}
function privateView(p) { return Object.assign(publicView(p), { seed: p.seed, answers: p.answers }); }

// ---------- البث اللحظي للمعلمة ----------
const teacherStreams = new Set();
function broadcast(event, data) {
  const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (const res of teacherStreams) { try { res.write(msg); } catch (e) { } }
}
setInterval(() => { for (const res of teacherStreams) { try { res.write(': keepalive ' + Date.now() + '\n\n'); } catch (e) { } } }, 15000);

// ---------- منطق اللعبة ----------
function findByName(name, cls) {
  const nn = normName(name), nc = normName(cls);
  return Object.values(db.players).find(p => normName(p.name) === nn && normName(p.cls) === nc);
}
function createPlayer(name, cls, pid, seed, joinedAt) {
  const count = Object.keys(db.players).length;
  const p = {
    pid: pid || newId(), name, cls, seed: seed || newId(),
    avatar: AVATARS[count % AVATARS.length], color: COLORS[(count * 5) % COLORS.length],
    joinedAt: joinedAt || Date.now(), lastSeen: Date.now(), view: 'intro',
    solved: {}, wrong: {}, hints: {}, answers: {}, bombVariant: 0, explosions: 0, finishedAt: null
  };
  db.players[p.pid] = p;
  return p;
}
function applySolve(p, id, variant, answer) {
  const h = p.hints[id] || 0, w = p.wrong[id] || 0;
  p.solved[id] = { at: Date.now(), hints: h, wrong: w, score: P.puzzleScore(h, w), gem: P.isGem(h, w) };
  p.answers[id] = { v: variant, a: answer };
  if (!p.finishedAt && P.PUZZLES.every(x => p.solved[x])) p.finishedAt = Date.now();
}

function handleJoin(body) {
  const name = clean(body.name, 30), cls = clean(body.cls, 20);
  if (!name || name.length < 2) return { status: 400, data: { error: 'اكتبي اسمك (حرفان على الأقل)' } };
  if (!cls) return { status: 400, data: { error: 'اختاري فصلك' } };
  let p = body.pid && db.players[body.pid];
  if (p && normName(p.name) !== normName(name)) p = null;
  if (!p) p = findByName(name, cls);
  let restored = 0;
  const b0 = body.backup;
  const canRestore = b0 && typeof b0.seed === 'string' && b0.seed.length >= 6 &&
    (b0.session === db.session || (bootFresh && Number(b0.lastActive) > Date.now() - 3 * 3600 * 1000));
  if (!p && canRestore) {
    // الخادم لا يعرف هذه الطالبة (مثلًا بعد إعادة تشغيله): نستعيد تقدمها من جهازها مع إعادة تصحيح كل إجابة
    const b = body.backup;
    const pid = typeof b.pid === 'string' && /^[\w-]{6,30}$/.test(b.pid) && !db.players[b.pid] ? b.pid : null;
    p = createPlayer(name, cls, pid, b.seed.slice(0, 40), Number(b.joinedAt) || Date.now());
    p.bombVariant = Math.max(0, Math.min(50, Number(b.bombVariant) || 0));
    p.explosions = Math.max(0, Math.min(50, Number(b.explosions) || 0));
    for (const id of P.PUZZLES) {
      if (b.hints && b.hints[id]) p.hints[id] = Math.max(0, Math.min(3, Number(b.hints[id]) || 0));
      if (b.wrong && b.wrong[id]) p.wrong[id] = Math.max(0, Math.min(99, Number(b.wrong[id]) || 0));
    }
    for (const id of P.PUZZLES) {
      const rec = b.answers && b.answers[id];
      if (!rec) continue;
      const v = P.BOMB.includes(id) ? Number(rec.v) || 0 : 0;
      if (P.check(id, p.seed, v, rec.a).ok) { applySolve(p, id, v, rec.a); restored++; }
    }
  }
  if (!p) p = createPlayer(name, cls);
  p.lastSeen = Date.now();
  save();
  broadcast('player', publicView(p));
  return { status: 200, data: { player: privateView(p), restored, session: db.session } };
}

function handleAttempt(body) {
  const p = db.players[body.pid];
  if (!p) return { status: 404, data: { error: 'unknown player' } };
  const id = body.id;
  if (!P.PUZZLES.includes(id)) return { status: 400, data: { error: 'bad puzzle' } };
  p.lastSeen = Date.now();
  if (p.solved[id]) return { status: 200, data: { ok: true, already: true, player: privateView(p) } };
  const variant = P.BOMB.includes(id) ? (p.bombVariant || 0) : 0;
  if (P.BOMB.includes(id) && Number(body.variant) !== variant) return { status: 409, data: { error: 'stale', player: privateView(p) } };
  const res = P.check(id, p.seed, variant, body.answer);
  if (res.ok) applySolve(p, id, variant, body.answer);
  else if (!res.partial) p.wrong[id] = (p.wrong[id] || 0) + 1;
  save();
  broadcast('player', publicView(p));
  return { status: 200, data: { ok: res.ok, partial: !!res.partial, fb: res.fb, player: privateView(p) } };
}

function handleHint(body) {
  const p = db.players[body.pid];
  if (!p || !P.PUZZLES.includes(body.id)) return { status: 404, data: { error: 'unknown' } };
  if (!p.solved[body.id]) p.hints[body.id] = Math.min(3, (p.hints[body.id] || 0) + 1);
  p.lastSeen = Date.now();
  save();
  broadcast('player', publicView(p));
  return { status: 200, data: { level: p.hints[body.id] || 0, player: privateView(p) } };
}

function handleExplode(body) {
  const p = db.players[body.pid];
  if (!p) return { status: 404, data: { error: 'unknown' } };
  if (Number(body.variant) === (p.bombVariant || 0) && P.BOMB.some(id => !p.solved[id])) {
    p.bombVariant = (p.bombVariant || 0) + 1;
    p.explosions = (p.explosions || 0) + 1;
    save();
    broadcast('player', publicView(p));
  }
  return { status: 200, data: { player: privateView(p) } };
}

function handlePing(body) {
  const p = db.players[body.pid];
  if (!p) return { status: 404, data: { error: 'unknown' } };
  p.lastSeen = Date.now();
  if (typeof body.view === 'string') p.view = body.view.slice(0, 30);
  broadcast('seen', { pid: p.pid, lastSeen: p.lastSeen, view: p.view });
  return { status: 200, data: { ok: true } };
}

// ---------- CSV ----------
function csv() {
  const head = ['الاسم', 'الفصل', 'الغرفة الحالية', 'الألغاز المحلولة', 'النقاط', 'الجواهر', 'التلميحات', 'المحاولات الخاطئة', 'الانفجارات', 'هربت من القلعة', 'وقت الدخول', 'وقت الهروب', 'المدة بالدقائق']
    .concat(P.PUZZLES.map(id => P.TITLES[id]));
  const rows = [head];
  const fmtT = t => t ? new Date(t).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '';
  Object.values(db.players).map(publicView).sort((a, b) => b.score - a.score).forEach(v => {
    const room = v.room === 6 ? 'الكنز' : P.ROOMS[v.room - 1].name;
    rows.push([v.name, v.cls, room, v.solvedCount + '/' + v.total, v.score, v.gems, v.totalHints, v.totalWrong, v.explosions,
      v.finishedAt ? 'نعم' : 'لا', fmtT(v.joinedAt), fmtT(v.finishedAt), v.finishedAt ? Math.round((v.finishedAt - v.joinedAt) / 60000) : '']
      .concat(P.PUZZLES.map(id => v.solved[id] ? ('✓ تلميحات ' + v.solved[id].hints + ' / أخطاء ' + v.solved[id].wrong) : ((v.wrong[id] || v.hints[id]) ? '✗ أخطاء ' + (v.wrong[id] || 0) : ''))));
  });
  return '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function send(res, status, data, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 100000) { req.destroy(); resolve(null); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function serveFile(res, file) {
  const ext = path.extname(file);
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(buf);
  });
}
function teacherOk(url, body) { return (url.searchParams.get('key') || (body && body.key)) === TEACHER_KEY; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (req.method === 'GET') {
      if (p === '/' || p === '/index.html') return serveFile(res, path.join(PUBLIC, 'index.html'));
      if (p === '/teacher' || p === '/teacher/') return serveFile(res, path.join(PUBLIC, 'teacher.html'));
      if (p === '/health') return send(res, 200, { ok: true, players: Object.keys(db.players).length });
      if (p === '/api/teacher/stream') {
        if (!teacherOk(url)) return send(res, 401, { error: 'unauthorized' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 2000\n\n');
        res.write('event: snapshot\ndata: ' + JSON.stringify({ now: Date.now(), players: Object.values(db.players).map(publicView), sessionStarted: db.sessionStarted }) + '\n\n');
        teacherStreams.add(res);
        req.on('close', () => teacherStreams.delete(res));
        return;
      }
      if (p === '/api/teacher/export.csv') {
        if (!teacherOk(url)) return send(res, 401, { error: 'unauthorized' });
        return send(res, 200, csv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="castle-results.csv"' });
      }
      const name = p.replace(/^\/+/, '');
      if (!STATIC.has(name)) return send(res, 404, { error: 'not found' });
      return serveFile(res, path.join(PUBLIC, name));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad body' });
      let r;
      if (p === '/api/join') r = handleJoin(body);
      else if (p === '/api/attempt') r = handleAttempt(body);
      else if (p === '/api/hint') r = handleHint(body);
      else if (p === '/api/explode') r = handleExplode(body);
      else if (p === '/api/ping') r = handlePing(body);
      else if (p === '/api/teacher/login') {
        r = String(body.password || '') === TEACHER_PASSWORD ? { status: 200, data: { key: TEACHER_KEY } } : { status: 401, data: { error: 'كلمة المرور غير صحيحة' } };
      } else if (p === '/api/teacher/remove') {
        if (!teacherOk(url, body)) return send(res, 401, { error: 'unauthorized' });
        delete db.players[body.pid]; save(); broadcast('remove', { pid: body.pid }); r = { status: 200, data: { ok: true } };
      } else if (p === '/api/teacher/reset') {
        if (!teacherOk(url, body)) return send(res, 401, { error: 'unauthorized' });
        db.archive.push({ endedAt: Date.now(), players: Object.values(db.players).map(publicView) });
        if (db.archive.length > 30) db.archive.shift();
        db.players = {}; db.sessionStarted = Date.now(); db.session = crypto.randomBytes(6).toString('hex'); bootFresh = false; save();
        broadcast('snapshot', { now: Date.now(), players: [], sessionStarted: db.sessionStarted });
        r = { status: 200, data: { ok: true } };
      } else r = { status: 404, data: { error: 'not found' } };
      return send(res, r.status, r.data);
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
});
server.listen(PORT, () => console.log('قلعة الدوال تعمل على المنفذ ' + PORT));
module.exports = server;
