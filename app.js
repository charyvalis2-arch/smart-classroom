'use strict';
/* ============================================================
   智慧課堂 — 主程式
   區塊：工具 / 音效 / 狀態 / 雲端 / 分頁 / 抽籤 / 計分 / 計時 /
        分組 / 音量計 / 成績單 / 異質性分組工作表 / 設定 / 啟動
   ============================================================ */

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let _uid = 0;
const uid = () => `s${Date.now().toString(36)}${(_uid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const parseNames = text => String(text || '').split(/[\n,，、;；\t]+/).map(s => s.trim()).filter(Boolean);
const COLORS = ['#FF6B6B', '#4DABF7', '#51CF66', '#FCC419', '#AE3EC9', '#E8590C', '#0C8599', '#F06595'];

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 音效（Web Audio 合成，免外部檔案）---------- */
const Sound = {
  ctx: null,
  init() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.ctx = new C(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur, start, type = 'sine', vol = .15) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(.001, start + dur);
    o.connect(g); g.connect(c.destination); o.start(start); o.stop(start + dur + .02);
  },
  noise(start, dur, filterType, freq, Q, shape) {
    const c = this.ctx, n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = Q || 1;
    const g = c.createGain(); shape(g.gain, start, dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(start); src.stop(start + dur);
  },
  play(name) {
    try {
      if (!this.init()) return;
      const fn = this.lib[name]; if (fn) fn(this.ctx.currentTime);
    } catch (e) { console.warn('音效播放失敗', e); }
  },
  lib: {
    click: t => Sound.tone(600, .05, t, 'sine', .05),
    attention: t => { Sound.tone(880, .3, t); Sound.tone(659.25, .5, t + .25); },
    correct: t => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => Sound.tone(f, .12, t + i * .08, 'sine', .1)); Sound.tone(1318.5, .5, t + .32); },
    wrong: t => {
      const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(130, t); o.frequency.linearRampToValueAtTime(70, t + .4);
      g.gain.setValueAtTime(.25, t); g.gain.linearRampToValueAtTime(.001, t + .4);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .42);
    },
    applause: t => { for (let i = 0; i < 46; i++) Sound.noise(t + Math.random() * 1.6, .07, 'bandpass', 1200 + Math.random() * 2500, 1, (p, s, d) => { p.setValueAtTime(.18, s); p.exponentialRampToValueAtTime(.001, s + d); }); },
    drumroll: t => Sound.noise(t, 1.4, 'lowpass', 300, 1, (p, s) => {
      p.setValueAtTime(.01, s);
      for (let i = 0; i < 1; i += .05) { const v = .03 + i * .17; p.setValueAtTime(v, s + i); p.setValueAtTime(v * .2, s + i + .025); }
      p.setValueAtTime(.22, s + 1); p.exponentialRampToValueAtTime(.001, s + 1.35);
    }),
    cheer: t => { Sound.tone(392, .4, t, 'triangle', .1); Sound.tone(523.25, .4, t + .1, 'triangle', .1); Sound.tone(659.25, .4, t + .2, 'triangle', .1); Sound.tone(783.99, .8, t + .3); },
    countdown_end: t => { for (let i = 0; i < 3; i++) { Sound.tone(587.33, .15, t + i * .4, 'sine', .2); Sound.tone(880, .15, t + i * .4 + .15, 'sine', .2); } Sound.tone(1174.66, .8, t + 1.2, 'sine', .25); },
    shh: t => Sound.noise(t, 1.2, 'bandpass', 4000, 1.5, (p, s) => { p.setValueAtTime(0, s); p.linearRampToValueAtTime(.2, s + .1); p.exponentialRampToValueAtTime(.001, s + 1.1); }),
    pop: t => {
      const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(350 + Math.random() * 80, t); o.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 200, t + .06);
      g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .07);
    }
  }
};

/* ---------- 全域狀態 ---------- */
const DEFAULT_STUDENTS = ['張小明', '李大同', '王中天', '趙小美', '陳心怡', '林志豪', '黃曉莉', '徐子晴', '吳建國', '賴冠宇'];
const state = {
  students: [], classes: [], classId: '',
  teams: store.get('local_teams', ['第一組', '第二組', '第三組', '第四組', '第五組', '第六組'].map((n, i) => ({ name: n, score: 0, color: COLORS[i] }))),
  drawPool: [], drawnList: [], reportCards: [],
  apiUrl: localStorage.getItem('gas_api_url') || '',
  lastError: ''
};

/* ---------- 小組計分板：預設六組（舊資料補到六組，只做一次）---------- */
if (!store.get('teams_v6', false)) {
  const nm = ['第一組', '第二組', '第三組', '第四組', '第五組', '第六組'];
  while (state.teams.length < 6) { const n = state.teams.length; state.teams.push({ name: nm[n], score: 0, color: COLORS[n % COLORS.length] }); }
  store.set('local_teams', state.teams); store.set('teams_v6', true);
}

/* ---------- 多班級名單（至少三個班，可選班級）---------- */
const DEFAULT_CLASS_NAMES = ['711', '712', '713'];
(function initClasses() {
  let cl = store.get('local_classes', null);
  if (!Array.isArray(cl) || !cl.length) {
    cl = DEFAULT_CLASS_NAMES.map((n, i) => ({ id: 'c' + (i + 1), name: n, students: i === 0 ? store.get('local_students', DEFAULT_STUDENTS) : [] }));
    const tb = store.get('tb_state', null); if (tb) store.set('tb_state_c1', tb);
    const rc = store.get('report_cards_data', null); if (rc) store.set('report_cards_data_c1', rc);
  }
  while (cl.length < 3) { const n = cl.length + 1; cl.push({ id: 'c' + n + Date.now().toString(36), name: DEFAULT_CLASS_NAMES[n - 1] || `${n}班`, students: [] }); }
  state.classes = cl; store.set('local_classes', cl);
  const cur = localStorage.getItem('cur_class'); state.classId = cl.some(c => c.id === cur) ? cur : cl[0].id;
  state.students = cl.find(c => c.id === state.classId).students;
})();
const currentClass = () => state.classes.find(c => c.id === state.classId) || state.classes[0];
const persistClasses = () => store.set('local_classes', state.classes);
const rcKey = () => 'report_cards_data_' + state.classId;
function renderClassSelects() {
  document.querySelectorAll('.class-select').forEach(sel => {
    sel.innerHTML = state.classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}（${c.students.length} 人）</option>`).join(''); sel.value = state.classId;
  });
  const r = $('class-rename'); if (r) r.value = currentClass().name;
}
function switchClass(id) {
  if (!state.classes.some(c => c.id === id) || id === state.classId) { renderClassSelects(); return; }
  if (state.classId) TB.save(); state.classId = id; localStorage.setItem('cur_class', id); state.reportCards = [];
  setStudents(currentClass().students, { persist: false }); TB.reload();
  if ($('tab-report-card').classList.contains('active')) initReportTab();
  document.dispatchEvent(new CustomEvent('classchange')); toast(`🏫 已切換到「${currentClass().name}」`);
}

/* ---------- 雲端 API（Google Apps Script，選用）---------- */
function setSync(status) {
  $('sync-indicator').className = 'sync-status ' + status;
  $('sync-text').textContent = { online: '已連線至雲端 Sheets', offline: '本地離線模式', syncing: '雲端同步中…' }[status];
}
async function callApi(action, method = 'GET', body = null) {
  if (!state.apiUrl) return null;
  setSync('syncing');
  try {
    let url = state.apiUrl; const cfg = { method, mode: 'cors', credentials: 'omit' };
    if (method === 'GET') url += (url.includes('?') ? '&' : '?') + 'action=' + encodeURIComponent(action);
    else { cfg.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; cfg.body = JSON.stringify({ action, ...body }); }
    const res = await fetch(url, cfg), json = await res.json();
    if (json && json.success) { setSync('online'); return json; }
    throw new Error((json && json.error) || '未知後端錯誤');
  } catch (e) {
    console.error('API 呼叫失敗', e); state.lastError = e.message || String(e);
    setSync('offline'); toast('⚠️ 雲端連線失敗，已改用本機儲存'); return null;
  }
}

/* ---------- 分頁 ---------- */
function initTabs() {
  const btns = document.querySelectorAll('.nav-btn'), tabs = document.querySelectorAll('.tab-content');
  btns.forEach(b => b.addEventListener('click', () => {
    Sound.play('click');
    btns.forEach(x => x.classList.remove('active')); tabs.forEach(x => x.classList.remove('active'));
    b.classList.add('active'); $('tab-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'report-card') initReportTab();
    if (b.dataset.tab === 'grouper') $('grouper-count').textContent = state.students.length;
    if (b.dataset.tab === 'noise') NoiseMeter.fitCanvas();
    $('sidebar').classList.remove('mobile-open'); window.scrollTo(0, 0);
  }));
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('mobile-open'));
}

/* ---------- 名單（全站共用）---------- */
function setStudents(list, { persist = true } = {}) {
  currentClass().students = list; state.students = list; if (persist) persistClasses();
  $('txt-students').value = list.join('\n'); $('grouper-count').textContent = list.length;
  renderClassSelects(); initDrawPool();
}

/* ============================================================
   1. 隨機抽籤
   ============================================================ */
const drawKey = () => 'draw_drawn_' + state.classId;
function initDrawPool() {
  const pool = [...state.students], drawn = [];
  store.get(drawKey(), []).forEach(n => { const i = pool.indexOf(n); if (i >= 0) { pool.splice(i, 1); drawn.push(n); } });
  state.drawPool = pool; state.drawnList = drawn; updatePickerUI();
}
function resetDrawPool() { store.set(drawKey(), []); initDrawPool(); }
function updatePickerUI() {
  $('stat-remaining').textContent = state.drawPool.length; $('stat-drawn').textContent = state.drawnList.length;
  const ul = $('drawn-list');
  if (!state.drawnList.length) { ul.innerHTML = '<li class="empty-msg">尚無抽籤紀錄</li>'; return; }
  const n = state.drawnList.length;
  ul.innerHTML = [...state.drawnList].reverse().map((name, i) => `<li><span><span class="index">${n - i}</span>${esc(name)}</span><span class="hit">中籤🎯</span></li>`).join('');
}
let isDrawing = false;
function drawStudent() {
  if (isDrawing) return;
  const noRepeat = $('chk-norepeat').checked, pool = noRepeat ? state.drawPool : state.students;
  if (!pool.length) { toast(state.students.length ? '⚠️ 所有人都被抽過囉！請重設抽籤池。' : '⚠️ 名單是空的，請先到「雲端與名單設定」輸入名單。'); Sound.play('wrong'); return; }
  isDrawing = true; $('btn-draw').disabled = true; Sound.play('drumroll');
  const H = 90, N = 28, stopIdx = N - 2, reel = $('slot-reel');
  const winnerIdx = Math.floor(Math.random() * pool.length), winner = pool[winnerIdx];
  const items = Array.from({ length: N }, () => pool[Math.floor(Math.random() * pool.length)]); items[stopIdx] = winner;
  reel.innerHTML = items.map(n => `<div class="slot-item" style="color:${COLORS[Math.floor(Math.random() * COLORS.length)]}">${esc(n)}</div>`).join('');
  reel.style.transition = 'none'; reel.style.transform = 'translateY(0)'; void reel.offsetHeight;
  reel.style.transition = 'transform 2.6s cubic-bezier(.12,.8,.12,1)'; reel.style.transform = `translateY(-${stopIdx * H}px)`;
  setTimeout(() => {
    Sound.play('correct'); Sound.play('cheer');
    if (noRepeat) state.drawPool.splice(winnerIdx, 1);
    state.drawnList.push(winner); store.set(drawKey(), state.drawnList); callApi('logDraw', 'POST', { studentName: winner });
    updatePickerUI(); isDrawing = false; $('btn-draw').disabled = false;
  }, 2650);
}

/* ============================================================
   2. 小組計分板
   ============================================================ */
function renderTeams() {
  const grid = $('teams-grid');
  if (!state.teams.length) { grid.innerHTML = '<div class="empty-msg">目前沒有組別，請點選「新增組別」建立。</div>'; return; }
  grid.innerHTML = state.teams.map((t, i) => `
    <div class="team-card" data-i="${i}">
      <div class="team-stripe" style="background:${esc(t.color || '#4DABF7')}"></div>
      <button class="team-delete-btn" data-act="del" title="刪除">✕</button>
      <input type="text" class="team-name" value="${esc(t.name)}" data-act="name">
      <div class="team-score" id="score-${i}">${t.score}</div>
      <div class="score-controls"><button class="btn-score sub" data-act="sub">−1</button><button class="btn-score add" data-act="add">+1</button></div>
    </div>`).join('');
}
function saveTeamsLocal() { store.set('local_teams', state.teams); }
let saveTimer;
const debouncedSaveScores = () => { saveTeamsLocal(); clearTimeout(saveTimer); saveTimer = setTimeout(saveScoresCloud, 2000); };
async function saveScoresCloud() {
  saveTeamsLocal();
  const r = await callApi('saveScores', 'POST', { teams: state.teams });
  if (state.apiUrl) toast(r ? '💾 小組積分已同步至雲端' : '💾 分數已存於本機');
}
function initScoreboard() {
  $('teams-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = +b.closest('.team-card').dataset.i, act = b.dataset.act;
    if (act === 'add' || act === 'sub') {
      state.teams[i].score += act === 'add' ? 1 : -1;
      const el = $('score-' + i); el.textContent = state.teams[i].score; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      Sound.play('click'); debouncedSaveScores();
    } else if (act === 'del') {
      Sound.play('click');
      if (confirm(`確定要刪除「${state.teams[i].name}」嗎？`)) { state.teams.splice(i, 1); renderTeams(); debouncedSaveScores(); }
    }
  });
  $('teams-grid').addEventListener('change', e => {
    if (e.target.dataset.act !== 'name') return;
    const i = +e.target.closest('.team-card').dataset.i;
    state.teams[i].name = e.target.value.trim() || `第 ${i + 1} 組`; e.target.value = state.teams[i].name; debouncedSaveScores();
  });
  $('btn-add-team').addEventListener('click', () => {
    Sound.play('click'); const n = state.teams.length;
    state.teams.push({ name: `第 ${n + 1} 組`, score: 0, color: COLORS[n % COLORS.length] }); renderTeams(); debouncedSaveScores();
  });
  $('btn-reset-scores').addEventListener('click', () => {
    Sound.play('wrong');
    if (confirm('確定要把所有小組的分數重設歸零嗎？')) { state.teams.forEach(t => t.score = 0); renderTeams(); debouncedSaveScores(); }
  });
  $('btn-save-scores').addEventListener('click', () => { Sound.play('click'); saveScoresCloud(); if (!state.apiUrl) toast('💾 分數已存於本機'); });
}

/* ============================================================
   3. 課堂計時器（以結束時間戳計算，切換分頁也準確）
   ============================================================ */
/* 把「靜音 + 結尾鈴聲」做成一段 WAV，用 <audio> 播放：
   iPad 切到別的 App、螢幕被移開或鎖定時，媒體播放仍會繼續，鈴聲就會在時間到時準時響起。 */
const Alarm = {
  SR: 5000, MAXSEC: 1800,
  tone(buf, start, dur, f, amp) {
    const n = Math.floor(dur * this.SR), s0 = Math.floor(start * this.SR);
    for (let i = 0; i < n && s0 + i < buf.length; i++) buf[s0 + i] += Math.sin(2 * Math.PI * f * i / this.SR) * amp * Math.min(1, (n - i) / (0.08 * this.SR)) * Math.min(1, i / (0.01 * this.SR));
  },
  pattern() {  // 兩輪「叮叮叮—叮～」，共約 5 秒
    const len = Math.floor(5.2 * this.SR), buf = new Float32Array(len);
    [0, 2.6].forEach(o => { for (let k = 0; k < 3; k++) { this.tone(buf, o + k * .4, .15, 587.33, .9); this.tone(buf, o + k * .4 + .15, .15, 880, .9); } this.tone(buf, o + 1.25, 1.2, 1174.66, 1); });
    return buf;
  },
  make(silentSec) {
    const SR = this.SR, tail = this.pattern(), sil = Math.max(0, Math.floor(silentSec * SR)), n = sil + tail.length;
    const ab = new ArrayBuffer(44 + n), v = new DataView(ab), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    const u8 = new Uint8Array(ab, 44); u8.fill(128);
    for (let i = 0; i < tail.length; i++) u8[sil + i] = Math.max(0, Math.min(255, 128 + Math.round(tail[i] * 120)));
    return URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
  }
};
const Timer = {
  total: 300, remaining: 300, running: false, endAt: 0, tid: null, armedSec: 0, audioMode: false, url: null, wake: null,
  render() {
    const m = Math.floor(this.remaining / 60), s = this.remaining % 60;
    $('timer-text').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const P = 2 * Math.PI * 45, ratio = this.total > 0 ? this.remaining / this.total : 0;
    $('timer-progress').style.strokeDashoffset = P - ratio * P;
    const warn = this.running && this.remaining <= 10 && this.remaining > 0;
    $('timer-progress').classList.toggle('warn', warn); $('timer-text').classList.toggle('warn', warn);
    if (this.running) document.title = `⏱ ${$('timer-text').textContent}｜翠屏老師的國文課`; else document.title = BASE_TITLE;
  },
  buttons() { $('btn-timer-start').disabled = this.running; $('btn-timer-pause').disabled = !this.running; },
  /* 背景播放：預先把鈴聲排進音訊裡 */
  arm(sec, testOnly) {
    const au = $('timer-audio'); this.disarm();
    if (!testOnly && sec > Alarm.MAXSEC) { this.audioMode = false; return; }   // 太長就退回一般提示音
    this.url = Alarm.make(testOnly ? 0 : sec); this.armedSec = testOnly ? 0 : sec; au.src = this.url; au.volume = 1; au.currentTime = 0;
    this.audioMode = true; const p = au.play(); if (p && p.catch) p.catch(() => { this.audioMode = false; });
    if ('mediaSession' in navigator && !testOnly) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: '課堂計時中', artist: '翠屏老師的國文課' }); } catch (e) {} }
  },
  disarm() { const au = $('timer-audio'); try { au.pause(); } catch (e) {} if (this.url) { URL.revokeObjectURL(this.url); this.url = null; } this.audioMode = false; },
  async keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !this.wake) { this.wake = await navigator.wakeLock.request('screen'); this.wake.addEventListener('release', () => { this.wake = null; }); }
      else if (!on && this.wake) { await this.wake.release(); this.wake = null; }
    } catch (e) { this.wake = null; }
  },
  finish() {
    clearInterval(this.tid); this.running = false; this.buttons(); this.render(); this.keepAwake(false);
    const au = $('timer-audio'), handled = this.audioMode && (au.ended || au.currentTime >= this.armedSec - 0.5 || !au.paused);
    if (!handled) Sound.play('countdown_end');
    toast('🔔 時間到囉！請收心');
  },
  start() {
    if (this.running || this.remaining <= 0) return;
    Sound.play('click'); this.running = true; this.endAt = Date.now() + this.remaining * 1000; this.buttons();
    this.arm(this.remaining); this.keepAwake(true);
    this.tid = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
      if (left !== this.remaining) { this.remaining = left; this.render(); }
      if (left <= 0) this.finish();
    }, 200);
    this.render();
  },
  pause() { if (!this.running) return; Sound.play('click'); clearInterval(this.tid); this.running = false; this.disarm(); this.keepAwake(false); this.buttons(); this.render(); },
  reset() { Sound.play('click'); clearInterval(this.tid); this.running = false; this.disarm(); this.keepAwake(false); this.remaining = this.total; this.buttons(); this.render(); },
  set(sec) { Sound.play('click'); clearInterval(this.tid); this.running = false; this.disarm(); this.keepAwake(false); this.total = this.remaining = Math.max(0, sec); this.buttons(); this.render(); },
  test() { this.disarm(); this.arm(0, true); toast('🔔 測試鈴聲（iPad 請確認音量、且未開靜音）'); }
};
const BASE_TITLE = document.title;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !Timer.running) return;
  Timer.keepAwake(true);
  const left = Math.max(0, Math.ceil((Timer.endAt - Date.now()) / 1000)); Timer.remaining = left; Timer.render(); if (left <= 0) Timer.finish();
});

/* ============================================================
   4. 隨機分組器
   ============================================================ */
function makeGroups() {
  const by = document.querySelector('input[name="group-by"]:checked').value, num = parseInt($('group-num-input').value, 10);
  if (!state.students.length) { toast('⚠️ 請先在設定中輸入學生名單！'); return; }
  if (isNaN(num) || num < 1) { toast('⚠️ 請輸入大於 0 的正整數！'); return; }
  Sound.play('drumroll');
  const sh = shuffle(state.students); let groups = [];
  if (by === 'count') {
    const n = Math.min(num, sh.length); groups = Array.from({ length: n }, () => []); sh.forEach((s, i) => groups[i % n].push(s));
  } else {
    for (let i = 0; i < sh.length; i += num) groups.push(sh.slice(i, i + num));
  }
  $('groups-container').innerHTML = groups.map((m, i) => `
    <div class="group-box animate-in" style="animation-delay:${i * 60}ms;border-color:${COLORS[i % COLORS.length]}33">
      <h4 style="background:${COLORS[i % COLORS.length]}">第 ${i + 1} 組（${m.length} 人）</h4>
      <ul class="group-members">${m.map(n => `<li>👤 ${esc(n)}</li>`).join('')}</ul></div>`).join('');
  toast('🎲 隨機分組完成！');
}

/* ============================================================
   5. 班級趣味音量計（太吵泡泡會破掉）
   ============================================================ */
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const NoiseMeter = {
  stream: null, src: null, analyser: null, raf: null, on: false,
  over: 0, cooldown: false, bubbles: [], particles: [], vol: 0, respawning: false,
  palette: ['#FF6B6B', '#4DABF7', '#51CF66', '#FCC419', '#AE3EC9', '#E8590C', '#0CB4BE', '#F06595', '#22D3EE', '#A3E635'],
  cfg() { return { thr: +$('slider-threshold').value, sens: +$('slider-sens').value / 10 }; },
  fitCanvas() { const c = $('noise-canvas'); if (c && c.clientWidth > 0 && c.width !== c.clientWidth) c.width = c.clientWidth; },
  makeBubble(color) {
    const c = $('noise-canvas'), r = 14 + Math.random() * 12;
    return { x: r + Math.random() * (c.width - r * 2), y: r + Math.random() * (c.height - r * 2), r, vx: (Math.random() - .5) * 1.6, vy: (Math.random() - .5) * 1.6, color, popping: false, t: 0 };
  },
  initBubbles() { this.bubbles = Array.from({ length: 30 }, (_, i) => this.makeBubble(this.palette[i % this.palette.length])); this.particles = []; },
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('❌ 此瀏覽器或連線環境不支援麥克風（需使用 https）'); return; }
    try {
      const ctx = Sound.init();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 256;
      this.src = ctx.createMediaStreamSource(this.stream); this.src.connect(this.analyser);
      this.on = true; this.vol = 0; this.respawning = false; this.cooldown = false; this.over = 0;
      $('noise-off').style.display = 'none'; $('noise-on').style.display = 'flex'; $('btn-stop-mic').style.display = 'block';
      this.fitCanvas(); this.initBubbles(); toast('🎤 麥克風音量監測已啟動！'); this.loop();
    } catch (e) { console.error(e); toast('❌ 開啟麥克風失敗，請允許麥克風存取權限！'); }
  },
  stop() {
    this.on = false; cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.src) try { this.src.disconnect(); } catch (e) {}
    this.stream = this.src = this.analyser = null; this.bubbles = []; this.particles = [];
    $('noise-off').style.display = 'flex'; $('noise-on').style.display = 'none'; $('btn-stop-mic').style.display = 'none';
    document.body.classList.remove('flash-alert'); toast('⏹️ 麥克風監測已停止');
  },
  loop() {
    if (!this.on || !this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length, { thr, sens } = this.cfg();
    const vol = this.vol = Math.min(100, Math.round(avg * sens * 2.5));
    const bar = $('noise-bar'); bar.style.width = vol + '%'; bar.style.background = vol < 30 ? '#22c55e' : vol < thr ? '#eab308' : '#ef4444';
    $('noise-marker').style.left = thr + '%';
    const em = $('noise-emoji'), ti = $('noise-title'), de = $('noise-desc');
    if (!this.bubbles.length) { em.textContent = '💥'; ti.textContent = '班級狀態：全軍覆沒！'; de.textContent = '音量超標，所有泡泡都破掉了！請安靜讓泡泡重生！'; em.style.transform = 'scale(1.1)'; }
    else if (vol < 30) { em.textContent = '😇'; ti.textContent = '班級狀態：安靜乖巧'; de.textContent = '大家做得很好，泡泡們漂浮得很安心！'; em.style.transform = 'scale(1)'; }
    else if (vol < thr) { em.textContent = '🗣️'; ti.textContent = '班級狀態：小聲討論'; de.textContent = '小聲說話，泡泡開始震動起舞囉。'; em.style.transform = 'scale(1.05)'; }
    else { em.textContent = '😰'; ti.textContent = '班級狀態：太吵鬧了！'; de.textContent = '注意！討論聲過大，泡泡快要被震破了！'; em.style.transform = 'scale(1.2)'; }
    if (vol >= thr && !this.cooldown) { if (++this.over > 55 && this.bubbles.length) this.alert(); }
    else { this.over = Math.max(0, this.over - 1); if (!this.cooldown) document.body.classList.remove('flash-alert'); }
    this.draw(vol, thr); this.raf = requestAnimationFrame(() => this.loop());
  },
  alert() {
    this.cooldown = true; this.over = 0;
    if ($('chk-alert-sound').checked) Sound.play('shh');
    if ($('chk-alert-flash').checked) document.body.classList.add('flash-alert');
    toast('🤫 班級太吵囉！泡泡正在接連破裂！');
    setTimeout(() => { this.cooldown = false; document.body.classList.remove('flash-alert'); }, 3000);
  },
  burst(x, y, color) {
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5; this.particles.push({ x, y, s: 2 + Math.random() * 2.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, color, a: .7 }); }
  },
  draw(vol, thr) {
    const cv = $('noise-canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += .12; p.a -= .025;
      if (p.a <= 0) { this.particles.splice(i, 1); continue; }
      g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fillStyle = hexA(p.color, p.a.toFixed(2)); g.fill();
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (b.popping) {
        b.t += .08;
        if (b.t >= 1) { this.burst(b.x, b.y, b.color); Sound.play('pop'); this.bubbles.splice(i, 1); continue; }
        g.beginPath(); g.arc(b.x, b.y, b.r * (1 + b.t * .4), 0, 7); g.strokeStyle = hexA(b.color, (.6 * (1 - b.t)).toFixed(2)); g.lineWidth = 3 * (1 - b.t); g.stroke(); continue;
      }
      const k = 1 + vol / 20; b.x += b.vx * k; b.y += b.vy * k;
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; } if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; } if (b.y + b.r > H) { b.y = H - b.r; b.vy *= -1; }
      const j = vol > 40 ? vol / 7 : 0, dx = b.x + (Math.random() - .5) * j, dy = b.y + (Math.random() - .5) * j;
      const gr = g.createRadialGradient(dx - b.r * .25, dy - b.r * .25, b.r * .05, dx, dy, b.r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.15, hexA(b.color, .85)); gr.addColorStop(.65, hexA(b.color, .4)); gr.addColorStop(.92, hexA(b.color, .8)); gr.addColorStop(1, 'rgba(255,255,255,.2)');
      g.beginPath(); g.arc(dx, dy, b.r, 0, 7); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.2; g.stroke();
      g.beginPath(); g.arc(dx - b.r * .35, dy - b.r * .35, b.r * .16, 0, 7); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    }
    if (vol >= thr && Math.random() < .04) { const ok = this.bubbles.filter(b => !b.popping); if (ok.length) { const t = ok[Math.floor(Math.random() * ok.length)]; t.popping = true; t.t = 0; } }
    if (!this.bubbles.length && vol < thr && !this.respawning) {
      this.respawning = true;
      setTimeout(() => { if (this.on && this.vol < this.cfg().thr) { this.initBubbles(); toast('✨ 教室安靜下來了，泡泡重新誕生！'); } this.respawning = false; }, 2500);
    }
  }
};

/* ============================================================
   6. 段考成績單
   ============================================================ */
const SUBJ = [['chinese', '國語'], ['math', '數學'], ['english', '英語'], ['science', '自然'], ['social', '社會']];
function defaultTerm() {
  const d = new Date(), y = d.getFullYear() - 1911, m = d.getMonth() + 1;
  return m >= 8 ? `${y} 學年度第一學期` : m === 1 ? `${y - 1} 學年度第一學期` : `${y - 1} 學年度第二學期`;
}
const RC = { meta: Object.assign({ school: '', term: defaultTerm(), className: '', subjects: Object.fromEntries(SUBJ) }, store.get('report_meta', {})) };
const subjName = k => (RC.meta.subjects && RC.meta.subjects[k]) || SUBJ.find(s => s[0] === k)[1];
const blankCard = name => ({ name, chinese: 0, math: 0, english: 0, science: 0, social: 0, attitude: '優', comment: '' });

function renderRcMeta() {
  $('rc-school').value = RC.meta.school; $('rc-term').value = RC.meta.term; $('rc-class').value = RC.meta.className;
  $('rc-subjects').innerHTML = SUBJ.map(([k]) => `<div><label>科目 ${SUBJ.findIndex(s => s[0] === k) + 1}</label><input type="text" data-subj="${k}" value="${esc(subjName(k))}"></div>`).join('');
  SUBJ.forEach(([k]) => $('th-' + k).textContent = subjName(k));
}
function initReportTab() {
  if (!state.reportCards.length) loadReportCards(); else { renderReportTable(); updatePreviewSelect(); }
}
function renderReportTable() {
  const tb = $('report-body');
  if (!state.reportCards.length) { tb.innerHTML = '<tr><td colspan="9" class="empty-msg">尚無學生資料，請點選「➕ 載入班級名單」</td></tr>'; return; }
  tb.innerHTML = state.reportCards.map((s, i) => `<tr data-i="${i}">
    <td><b>${esc(s.name)}</b></td>
    ${SUBJ.map(([k]) => `<td><input type="number" min="0" max="100" data-f="${k}" value="${s[k] || 0}"></td>`).join('')}
    <td><select data-f="attitude">${['優', '甲', '乙', '丙'].map(a => `<option ${s.attitude === a ? 'selected' : ''}>${a}</option>`).join('')}</select></td>
    <td><input type="text" data-f="comment" placeholder="請輸入評語…" value="${esc(s.comment || '')}"></td>
    <td><button class="btn btn-danger btn-sm" data-del style="padding:4px 8px">✕</button></td></tr>`).join('');
}
function updatePreviewSelect() {
  const sel = $('select-preview'), cur = sel.value;
  sel.innerHTML = '<option value="">-- 請選擇學生 --</option>' + state.reportCards.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  sel.value = state.reportCards.some(s => s.name === cur) ? cur : '';
}
function classAverages() {
  const avg = {}, n = state.reportCards.length;
  SUBJ.forEach(([k]) => avg[k] = n ? state.reportCards.reduce((a, s) => a + (s[k] || 0), 0) / n : 0);
  return avg;
}
const gradeOf = v => v >= 90 ? '優' : v >= 80 ? '甲' : v >= 70 ? '乙' : v >= 60 ? '丙' : '丁';
function chartSvg(s, avg) {
  const bars = SUBJ.map(([k], i) => {
    const y = 10 + i * 32, pw = (s[k] || 0) / 100 * 230, aw = avg[k] / 100 * 230;
    return `<text x="10" y="${y + 16}" font-size="12" font-weight="bold" fill="#334155">${esc(subjName(k))}</text>
      <rect x="55" y="${y + 4}" width="${aw}" height="6" rx="2" fill="#cbd5e1"/><rect x="55" y="${y + 12}" width="${pw}" height="6" rx="2" fill="#3b82f6"/>
      <text x="292" y="${y + 14}" font-size="10.5" font-weight="600" fill="#475569">個人 ${s[k] || 0} / 班平均 ${avg[k].toFixed(1)}</text>`;
  }).join('');
  return `<svg width="100%" viewBox="0 0 430 180" style="background:#fff">${bars}
    <g transform="translate(55,166)"><rect width="10" height="10" rx="2" fill="#3b82f6"/><text x="15" y="9" font-size="10.5" fill="#475569">個人分數</text>
    <rect x="80" width="10" height="10" rx="2" fill="#cbd5e1"/><text x="95" y="9" font-size="10.5" fill="#475569">班級平均</text></g></svg>`;
}
function paperHTML(s, avg) {
  const total = SUBJ.reduce((a, [k]) => a + (s[k] || 0), 0), mean = total / SUBJ.length;
  return `<div class="paper-header"><h3 class="paper-title">🏫 ${esc(RC.meta.school)}段考成績個別通知單</h3><p class="paper-subtitle">${esc(RC.meta.term)} － 定期評量成績通知</p></div>
  <div class="paper-info"><div>班級：${esc(RC.meta.className)}</div><div>姓名：${esc(s.name)}</div><div>日期：${new Date().toLocaleDateString('zh-TW')}</div></div>
  <table class="paper-table"><thead><tr><th>評量科目</th><th>個人分數</th><th>評量等級</th><th>班級平均</th></tr></thead><tbody>
  ${SUBJ.map(([k]) => `<tr><td><b>${esc(subjName(k))}</b></td><td>${s[k] || 0}</td><td>${gradeOf(s[k] || 0)}</td><td>${avg[k].toFixed(1)}</td></tr>`).join('')}
  <tr style="background:#fafafa;font-weight:bold;border-top:2px solid #94a3b8"><td>總分 / 平均</td><td>${total} 分</td><td>平均 ${mean.toFixed(1)}</td><td>--</td></tr></tbody></table>
  <div class="paper-section-title">📊 學科成績與班級平均對比圖</div>${chartSvg(s, avg)}
  <div class="paper-comment"><div class="paper-section-title">📝 學習生活表現與導師評語</div>
    <div style="font-weight:700;color:#475569;margin-bottom:4px">學習態度表現：【${esc(s.attitude || '優')}】</div>
    <div>${esc(s.comment || '該生本學期學習態度良好，課堂參與度高，望下階段繼續保持努力。')}</div></div>
  <div class="paper-sign"><div>導師簽章：<div class="sign-line"></div></div><div>家長簽章：<div class="sign-line"></div></div></div>`;
}
function renderPreview() {
  const name = $('select-preview').value, box = $('paper');
  const s = state.reportCards.find(x => x.name === name);
  box.innerHTML = s ? paperHTML(s, classAverages()) : '<div class="empty-preview">請選擇上方學生以進行預覽</div>';
}
function printHTML(html) {
  $('print-area').innerHTML = html; document.body.classList.add('printing'); setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
async function saveReportCards() {
  Sound.play('click');
  if (!state.reportCards.length) { toast('⚠️ 尚無學生成績資料可儲存！'); return; }
  store.set(rcKey(), state.reportCards);
  if (!state.apiUrl) { toast('💾 成績已儲存於瀏覽器（本機）'); return; }
  toast('💾 正在同步成績至雲端…');
  const r = await callApi('saveReportCards', 'POST', { reports: state.reportCards });
  toast(r ? '✅ 成績已同步至 Google Sheets！' : '❌ 同步失敗，已存於本機');
}
async function loadReportCards() {
  if (state.apiUrl) {
    const r = await callApi('getReportCards', 'GET');
    if (r && r.reports && r.reports.length) { state.reportCards = r.reports; afterReportLoad('🔄 已從雲端載入段考成績！'); return; }
  }
  const local = store.get(rcKey(), null);
  if (local && local.length) { state.reportCards = local; afterReportLoad('🔄 已從瀏覽器載入成績紀錄'); }
  else { state.reportCards = state.students.map(blankCard); afterReportLoad(); }
}
function afterReportLoad(msg) { renderReportTable(); updatePreviewSelect(); renderPreview(); if (msg) toast(msg); }
function initReport() {
  renderRcMeta();
  const saveMeta = () => store.set('report_meta', RC.meta);
  $('rc-school').addEventListener('input', e => { RC.meta.school = e.target.value; saveMeta(); renderPreview(); });
  $('rc-term').addEventListener('input', e => { RC.meta.term = e.target.value; saveMeta(); renderPreview(); });
  $('rc-class').addEventListener('input', e => { RC.meta.className = e.target.value; saveMeta(); renderPreview(); });
  $('rc-subjects').addEventListener('input', e => {
    const k = e.target.dataset.subj; if (!k) return;
    RC.meta.subjects[k] = e.target.value.trim() || SUBJ.find(s => s[0] === k)[1]; $('th-' + k).textContent = RC.meta.subjects[k]; saveMeta(); renderPreview();
  });
  const body = $('report-body');
  body.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return; const s = state.reportCards[+e.target.closest('tr').dataset.i];
    if (e.target.type === 'number') s[f] = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); else s[f] = e.target.value;
    if ($('select-preview').value === s.name) renderPreview();
  });
  body.addEventListener('change', e => { if (e.target.dataset.f === 'attitude') { const s = state.reportCards[+e.target.closest('tr').dataset.i]; s.attitude = e.target.value; if ($('select-preview').value === s.name) renderPreview(); } });
  body.addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return; Sound.play('click');
    state.reportCards.splice(+e.target.closest('tr').dataset.i, 1); renderReportTable(); updatePreviewSelect(); renderPreview();
  });
  $('btn-report-import').addEventListener('click', () => {
    Sound.play('click'); if (!state.students.length) { toast('❌ 班級名單為空，請先在設定中輸入名單！'); return; }
    let n = 0; state.students.forEach(name => { if (!state.reportCards.some(s => s.name === name)) { state.reportCards.push(blankCard(name)); n++; } });
    renderReportTable(); updatePreviewSelect(); toast(`➕ 已新增 ${n} 位學生`);
  });
  $('btn-report-save').addEventListener('click', saveReportCards);
  $('btn-report-load').addEventListener('click', () => { Sound.play('click'); loadReportCards(); });
  $('select-preview').addEventListener('change', renderPreview);
  $('btn-print-single').addEventListener('click', () => {
    Sound.play('click'); const s = state.reportCards.find(x => x.name === $('select-preview').value);
    if (!s) { toast('⚠️ 請先選擇一位學生進行預覽！'); return; }
    printHTML(`<div class="print-card"><div class="paper">${paperHTML(s, classAverages())}</div></div>`);
  });
  $('btn-print-all').addEventListener('click', () => {
    Sound.play('click'); if (!state.reportCards.length) { toast('⚠️ 尚無任何成績資料可列印！'); return; }
    const avg = classAverages(); printHTML(state.reportCards.map(s => `<div class="print-card"><div class="paper">${paperHTML(s, avg)}</div></div>`).join(''));
  });
}

/* ============================================================
   7. 異質性分組工作表
   ============================================================ */
const TB_ROLES = [
  { name: '組長', desc: '主持討論、分配工作、確認進度' }, { name: '記錄', desc: '記錄討論重點、填寫學習單' },
  { name: '發表', desc: '上台報告、統整小組意見' }, { name: '計時', desc: '控制時間、管理音量、維持秩序' },
  { name: '器材', desc: '領取/歸還教具、維護環境整潔' }, { name: '組員', desc: '積極參與討論、協助完成任務' }
];
const TB_RULES = `1. 尊重發言：別人說話時，眼睛注視對方，安靜聆聽不插嘴。
2. 輕聲細語：討論時控制音量，僅讓同組組員聽見即可。
3. 積極參與：每個人都要貢獻想法，沒有人是局外人。
4. 分工合作：各司其職，互相協助，共同完成小組任務。
5. 勇於發表：報告時聲音宏亮，大方展現小組成果。`;

const TB = {
  SLOTS: 6, MAXG: 12, s: null, sel: null, drag: null, editing: false,
  blankGroups() { const g = {}; for (let i = 1; i <= this.MAXG; i++) g[i] = Array(this.SLOTS).fill(null); return g; },
  load() {
    const v = store.get('tb_state_' + state.classId, {});
    const s = this.s = {
      pool: Array.isArray(v.pool) ? v.pool : [], groups: v.groups || this.blankGroups(), scores: v.scores || {}, honors: v.honors || {},
      roles: Array.isArray(v.roles) && v.roles.length === 6 ? v.roles : TB_ROLES.map(r => ({ ...r })),
      numGroups: v.numGroups >= 1 && v.numGroups <= this.MAXG ? v.numGroups : 6,
      className: v.className || currentClass().name, date: v.date || '', subject: v.subject || '', topic: v.topic || '', rules: v.rules ?? TB_RULES
    };
    for (let i = 1; i <= this.MAXG; i++) {
      const a = Array.isArray(s.groups[i]) ? s.groups[i].slice(0, this.SLOTS) : []; while (a.length < this.SLOTS) a.push(null); s.groups[i] = a;
    }
  },
  save() { if (this.s) store.set('tb_state_' + state.classId, this.s); },
  reload() {
    this.load(); const s = this.s; this.sel = null; this.editing = false;
    $('tb-numgroups').value = s.numGroups;
    [['tb-class', 'className'], ['tb-date', 'date'], ['tb-subject', 'subject'], ['tb-topic', 'topic']].forEach(([id, k]) => $(id).value = s[k]);
    $('tb-rules').value = s.rules; this.renderRoles(); this.renderPool(); this.renderGroups();
  },
  roleCls: i => 'r' + Math.min(i, 5),
  allStudents() { const m = new Map(); [...this.s.pool, ...Object.values(this.s.groups).flat().filter(Boolean)].forEach(x => m.set(x.id, x)); return [...m.values()]; },
  mk(name) { return { id: uid(), name }; },

  /* ----- 狀態操作 ----- */
  addNames(names) { this.s.pool.push(...names.map(n => this.mk(n))); this.save(); this.renderPool(); },
  firstEmpty() { for (let g = 1; g <= this.s.numGroups; g++) for (let i = 0; i < this.SLOTS; i++) if (!this.s.groups[g][i]) return { g, s: i }; return null; },
  takePool(id) { const i = this.s.pool.findIndex(x => x.id === id); return i < 0 ? null : this.s.pool.splice(i, 1)[0]; },
  put(stu, g, i) { const old = this.s.groups[g][i]; this.s.groups[g][i] = stu; if (old) this.s.pool.push(old); },
  swap(a, b) { const G = this.s.groups; [G[a.g][a.s], G[b.g][b.s]] = [G[b.g][b.s], G[a.g][a.s]]; },
  unassign(g, i) { const x = this.s.groups[g][i]; if (x) { this.s.groups[g][i] = null; this.s.pool.push(x); } },
  commit() { this.sel = null; this.save(); this.renderPool(); this.renderGroups(); },

  clickPool(id) {
    const stu = this.s.pool.find(x => x.id === id); if (!stu) return;
    if (this.sel) { this.takePool(id); this.put(stu, this.sel.g, this.sel.s); Sound.play('click'); return this.commit(); }
    const t = this.firstEmpty(); if (!t) { toast('⚠️ 所有組別已滿！'); return; }
    this.takePool(id); this.s.groups[t.g][t.s] = stu; Sound.play('click'); this.commit();
  },
  clickSlot(g, i) {
    const cur = { g, s: i };
    if (!this.sel) { this.sel = cur; return this.renderGroups(); }
    if (this.sel.g === g && this.sel.s === i) { this.sel = null; return this.renderGroups(); }
    const G = this.s.groups;
    if (!G[this.sel.g][this.sel.s] && !G[g][i]) { this.sel = cur; return this.renderGroups(); }
    this.swap(this.sel, cur); Sound.play('click'); this.commit();
  },
  dropSlot(g, i) {
    const d = this.drag; if (!d) return;
    if (d.from) this.swap(d.from, { g, s: i });
    else { const stu = this.takePool(d.id); if (stu) this.put(stu, g, i); }
    this.drag = null; this.commit();
  },
  dropPool() { const d = this.drag; if (!d || !d.from) return; this.unassign(d.from.g, d.from.s); this.drag = null; this.commit(); },
  fill(random) {
    if (!this.s.pool.length) { toast('⚠️ 未分組名單是空的'); return; }
    if (!this.firstEmpty()) { toast('⚠️ 所有組別已滿！'); return; }
    const src = random ? shuffle(this.s.pool) : [...this.s.pool], used = new Set(); let k = 0;
    const place = (g, i) => { if (k < src.length && !this.s.groups[g][i]) { this.s.groups[g][i] = src[k]; used.add(src[k].id); k++; } };
    if (random) { for (let i = 0; i < this.SLOTS; i++) for (let g = 1; g <= this.s.numGroups; g++) place(g, i); }   // 隨機平均：每組先各補一個職務
    else { for (let g = 1; g <= this.s.numGroups; g++) for (let i = 0; i < this.SLOTS; i++) place(g, i); }          // 依序：一組一組填滿
    this.s.pool = this.s.pool.filter(x => !used.has(x.id)); Sound.play(random ? 'drumroll' : 'click'); this.commit();
  },
  clearAll() {
    if (!confirm('確定要清空所有分組嗎？學生將回到未分組名單，組別分數與榮譽也會歸零。')) return;
    this.s.pool = this.allStudents(); this.s.groups = this.blankGroups(); this.s.scores = {}; this.s.honors = {}; this.commit();
  },
  setNum(n) {
    for (let g = n + 1; g <= this.MAXG; g++) { this.s.groups[g].forEach((x, i) => { if (x) { this.s.pool.push(x); this.s.groups[g][i] = null; } }); delete this.s.scores[g]; delete this.s.honors[g]; }
    this.s.numGroups = n; this.commit();
  },
  score(g, d) { this.s.scores[g] = Math.max(0, (this.s.scores[g] || 0) + d); this.save(); this.renderGroups(); },
  scoreAll(d) { for (let g = 1; g <= this.s.numGroups; g++) this.s.scores[g] = Math.max(0, (this.s.scores[g] || 0) + d); Sound.play(d > 0 ? 'correct' : 'wrong'); this.save(); this.renderGroups(); },
  toggleEdit() {
    const ta = $('tb-edit');
    if (this.editing) {
      const old = [...this.s.pool], next = parseNames(ta.value).map(n => { const i = old.findIndex(o => o.name === n); return i >= 0 ? old.splice(i, 1)[0] : this.mk(n); });
      this.s.pool = next; this.editing = false; this.save();
    } else { ta.value = this.s.pool.map(x => x.name).join('\n'); this.editing = true; }
    this.renderPool();
  },
  loadRoster() {
    const have = new Set(this.allStudents().map(x => x.name)), add = state.students.filter(n => !have.has(n));
    if (!state.students.length) { toast('❌ 班級名單為空，請先到「雲端與名單設定」輸入'); return; }
    this.addNames(add); toast(add.length ? `📋 已載入 ${add.length} 位學生` : '📋 名單內的學生都已在工作表中');
  },

  /* ----- 繪製 ----- */
  renderPool() {
    const list = $('tb-pool'), ta = $('tb-edit');
    $('tb-pool-count').textContent = this.s.pool.length;
    $('tb-edit-toggle').textContent = this.editing ? '✔️' : '✏️'; $('tb-edit-toggle').title = this.editing ? '完成編輯' : '直接編輯名單';
    list.style.display = this.editing ? 'none' : 'flex'; ta.style.display = this.editing ? 'block' : 'none';
    ['tb-fill', 'tb-fill-random'].forEach(id => $(id).disabled = this.editing || !this.s.pool.length);
    $('tb-clear').disabled = this.editing;
    list.innerHTML = this.s.pool.length ? this.s.pool.map(x =>
      `<div class="tb-student" draggable="true" data-id="${x.id}"><span>${esc(x.name)}</span><button class="x" data-del title="從名單刪除">✕</button></div>`).join('')
      : '<div class="empty-msg">目前無學生<br><small>點「匯入名單」或右上角 ✏️ 貼上名單</small></div>';
  },
  renderGroups() {
    const s = this.s; let html = '';
    for (let g = 1; g <= s.numGroups; g++) {
      const honor = !!s.honors[g];
      html += `<div class="tb-group ${honor ? 'honor' : ''}" data-g="${g}">
        <div class="tb-group-head"><span>第 ${g} 組 ${honor ? '🏅' : ''}</span>
          <div class="tb-ctrl"><button data-act="honor" class="${honor ? 'on' : ''}" title="${honor ? '取消榮譽小組' : '頒發榮譽證書'}">🏅</button>
            <button data-act="sub">−</button><span class="sc">${s.scores[g] || 0}</span><button data-act="add">+</button></div></div>
        <div class="tb-slots">${s.groups[g].map((stu, i) => {
          const r = s.roles[i] || s.roles[5], sel = this.sel && this.sel.g === g && this.sel.s === i;
          return `<div class="tb-slot ${stu ? 'filled' : ''} ${sel ? 'selected' : ''}" data-g="${g}" data-s="${i}">
            <div class="role-chip ${this.roleCls(i)}">${esc(r.name)}</div>
            ${stu ? `<div class="tb-name" draggable="true" data-g="${g}" data-s="${i}" data-id="${stu.id}">${esc(stu.name)}</div><button class="rm" data-rm title="移出組別">✕</button>`
                  : '<div class="tb-empty">（拖曳或點選）</div>'}</div>`;
        }).join('')}</div></div>`;
    }
    $('tb-groups').innerHTML = html;
  },
  renderRoles() {
    $('tb-roles').innerHTML = this.s.roles.map((r, i) => `<div class="tb-role-row">
      <input class="rn ${this.roleCls(i)}" data-i="${i}" data-f="name" value="${esc(r.name)}" title="職務名稱" maxlength="6">
      <input type="text" class="rd" data-i="${i}" data-f="desc" value="${esc(r.desc)}" placeholder="輸入職務說明…"></div>`).join('');
  },

  /* ----- 匯入 / 列印 ----- */
  openImport(show) { $('import-modal').classList.toggle('show', show); if (show) $('import-text').value = ''; },
  importFile(file) {
    if (!file) return;
    if (!window.XLSX) { toast('⚠️ Excel 解析元件尚未載入，請稍後再試（或改用貼上名單）'); return; }
    const rd = new FileReader();
    rd.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        const names = rows.flat().filter(v => v !== '' && v != null && (typeof v === 'string' || typeof v === 'number')).map(v => String(v).trim()).filter(v => v && !/^(姓名|名字|學生|學生姓名|名單|座號|name)$/i.test(v));
        if (!names.length) { toast('⚠️ 檔案裡沒有讀到姓名'); return; }
        this.addNames(names); this.openImport(false); toast(`📥 已匯入 ${names.length} 位學生`);
      } catch (e) { console.error(e); toast('❌ 檔案讀取失敗，請確認格式'); }
    };
    rd.readAsArrayBuffer(file);
  },
  print() {
    const s = this.s, blank = '__________';
    const groups = Array.from({ length: s.numGroups }, (_, k) => {
      const g = k + 1, honor = !!s.honors[g];
      return `<div class="pb-group ${honor ? 'honor' : ''}"><div class="pb-group-head"><span>第 ${g} 組</span><span>${honor ? '★ 榮譽小組　' : ''}得分：${s.scores[g] || 0}</span></div>
        ${s.groups[g].map((stu, i) => `<div class="pb-row"><span class="pb-role">${esc((s.roles[i] || s.roles[5]).name)}</span><span class="pb-name">${stu ? esc(stu.name) : ''}</span></div>`).join('')}</div>`;
    }).join('');
    printHTML(`<table class="pb-table"><thead><tr><td><div class="pb-head"><h1>異質性分組工作表</h1>
      <div class="pb-meta"><span>學科 / 領域：${esc(s.subject) || blank}</span><span>單元主題：${esc(s.topic) || blank}</span></div>
      <div class="pb-meta"><span>班級：${esc(s.className) || blank}</span><span>日期：${esc(s.date) || blank}</span></div></div></td></tr></thead>
      <tbody><tr><td><div class="pb-grid">${groups}</div>
      <div class="pb-legend"><h3>職務說明</h3>${s.roles.map(r => `<div><b>${esc(r.name)}</b>：${esc(r.desc)}</div>`).join('')}</div>
      <div class="pb-rules"><h3>班級公約 / 課堂守則</h3><pre>${esc(s.rules)}</pre></div></td></tr></tbody></table>`);
  },

  /* ----- 事件 ----- */
  init() {
    this.load();
    $('tb-numgroups').innerHTML = Array.from({ length: this.MAXG }, (_, i) => `<option value="${i + 1}">${i + 1} 組</option>`).join('');
    $('tb-numgroups').value = this.s.numGroups;
    [['tb-class', 'className'], ['tb-date', 'date'], ['tb-subject', 'subject'], ['tb-topic', 'topic']].forEach(([id, k]) => {
      $(id).value = this.s[k]; $(id).addEventListener('input', e => { this.s[k] = e.target.value; this.save(); });
    });
    $('tb-rules').value = this.s.rules; $('tb-rules').addEventListener('input', e => { this.s.rules = e.target.value; this.save(); });
    $('tb-numgroups').addEventListener('change', e => this.setNum(+e.target.value));
    $('tb-all-add').addEventListener('click', () => this.scoreAll(1));
    $('tb-all-sub').addEventListener('click', () => this.scoreAll(-1));
    $('tb-reset-score').addEventListener('click', () => { if (confirm('確定要重置所有組別分數為 0 嗎？')) { this.s.scores = {}; this.save(); this.renderGroups(); } });
    $('tb-btn-import').addEventListener('click', () => this.openImport(true));
    $('tb-btn-print').addEventListener('click', () => { Sound.play('click'); this.print(); });
    $('tb-edit-toggle').addEventListener('click', () => this.toggleEdit());
    $('tb-roster').addEventListener('click', () => this.loadRoster());
    $('tb-fill').addEventListener('click', () => this.fill(false));
    $('tb-fill-random').addEventListener('click', () => this.fill(true));
    $('tb-clear').addEventListener('click', () => this.clearAll());
    // 匯入視窗
    ['import-close', 'import-cancel'].forEach(id => $(id).addEventListener('click', () => this.openImport(false)));
    $('import-modal').addEventListener('click', e => { if (e.target === $('import-modal')) this.openImport(false); });
    $('import-file').addEventListener('change', e => { this.importFile(e.target.files[0]); e.target.value = ''; });
    $('import-ok').addEventListener('click', () => {
      const names = parseNames($('import-text').value); if (!names.length) { toast('⚠️ 請先輸入姓名'); return; }
      this.addNames(names); this.openImport(false); toast(`📥 已新增 ${names.length} 位學生`);
    });
    // 職務
    $('tb-roles').addEventListener('input', e => { const f = e.target.dataset.f; if (!f) return; this.s.roles[+e.target.dataset.i][f] = e.target.value; this.save(); this.renderGroups(); });
    // 未分組名單
    const pool = $('tb-pool');
    pool.addEventListener('click', e => {
      const row = e.target.closest('.tb-student'); if (!row) return;
      if (e.target.closest('[data-del]')) { if (confirm('確定要從名單中刪除此學生嗎？')) { this.takePool(row.dataset.id); this.save(); this.renderPool(); } return; }
      this.clickPool(row.dataset.id);
    });
    pool.addEventListener('dragstart', e => { const r = e.target.closest('.tb-student'); if (!r) return; this.drag = { id: r.dataset.id, from: null }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.dataset.id); });
    const card = $('tb-pool-card');
    card.addEventListener('dragover', e => { if (this.drag && this.drag.from) { e.preventDefault(); pool.classList.add('over'); } });
    card.addEventListener('dragleave', e => { if (!card.contains(e.relatedTarget)) pool.classList.remove('over'); });
    card.addEventListener('drop', e => { e.preventDefault(); pool.classList.remove('over'); this.dropPool(); });
    // 各組
    const gs = $('tb-groups');
    gs.addEventListener('click', e => {
      const grp = e.target.closest('.tb-group'); if (!grp) return; const g = +grp.dataset.g;
      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'add') this.score(g, 1); else if (act.dataset.act === 'sub') this.score(g, -1);
        else if (act.dataset.act === 'honor') { this.s.honors[g] = !this.s.honors[g]; if (this.s.honors[g]) Sound.play('cheer'); this.save(); this.renderGroups(); }
        return;
      }
      const slot = e.target.closest('.tb-slot'); if (!slot) return;
      if (e.target.closest('[data-rm]')) { this.unassign(g, +slot.dataset.s); return this.commit(); }
      this.clickSlot(g, +slot.dataset.s);
    });
    gs.addEventListener('dragstart', e => {
      const n = e.target.closest('.tb-name'); if (!n) return;
      this.drag = { id: n.dataset.id, from: { g: +n.dataset.g, s: +n.dataset.s } }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.dataset.id);
    });
    gs.addEventListener('dragover', e => { const sl = e.target.closest('.tb-slot'); if (sl && this.drag) { e.preventDefault(); sl.classList.add('over'); } });
    gs.addEventListener('dragleave', e => { const sl = e.target.closest('.tb-slot'); if (sl && !sl.contains(e.relatedTarget)) sl.classList.remove('over'); });
    gs.addEventListener('drop', e => { const sl = e.target.closest('.tb-slot'); if (!sl) return; e.preventDefault(); this.dropSlot(+sl.dataset.g, +sl.dataset.s); });
    document.addEventListener('dragend', () => { this.drag = null; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
    this.renderRoles(); this.renderPool(); this.renderGroups();
  }
};

/* ============================================================
   8. 雲端與名單設定
   ============================================================ */
async function loadStudentsCloud() {
  const r = await callApi('getStudents', 'GET');
  if (r && r.students && r.students.length) { setStudents(r.students); toast('👥 學生名單已與雲端同步！'); }
  else if (r) toast('☁️ 雲端目前沒有名單，請先儲存一次');
}
async function loadScoresCloud() {
  const r = await callApi('getScores', 'GET');
  if (r && r.teams && r.teams.length) { state.teams = r.teams; saveTeamsLocal(); renderTeams(); toast('🏆 小組積分已與雲端同步！'); }
}
async function testConnection() {
  const box = $('conn-result'); box.style.display = 'block'; box.className = 'connection-result-box'; box.textContent = '🔌 正在連接 Google Sheets…';
  const r = await callApi('init', 'GET');
  if (r) {
    box.className = 'connection-result-box success';
    box.innerHTML = `✅ 連線成功！<br>🔗 <a href="${esc(r.spreadsheetUrl)}" target="_blank" rel="noopener" style="font-weight:700">點此打開試算表</a>`;
    loadStudentsCloud(); loadScoresCloud();
  } else {
    box.className = 'connection-result-box error';
    box.textContent = `❌ 連線失敗（${state.lastError || '未知錯誤'}）。請確認網址正確，且部署時「誰可以存取」選「所有人」。`;
  }
}
function initSettings() {
  document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('class-select')) switchClass(e.target.value); });
  $('btn-class-rename').addEventListener('click', () => {
    const n = $('class-rename').value.trim(); if (!n) { toast('⚠️ 班級名稱不可為空'); return; }
    currentClass().name = n; persistClasses(); renderClassSelects(); document.dispatchEvent(new CustomEvent('classchange')); toast('✏️ 已更新班級名稱');
  });
  $('btn-class-add').addEventListener('click', () => {
    const n = (prompt('新班級名稱（例：714）：', '') || '').trim(); if (!n) return;
    const c = { id: 'c' + Date.now().toString(36), name: n, students: [] }; state.classes.push(c); persistClasses(); renderClassSelects(); switchClass(c.id);
  });
  $('btn-class-del').addEventListener('click', () => {
    if (state.classes.length <= 3) { toast('⚠️ 至少要保留 3 個班級'); return; }
    if (!confirm(`確定刪除「${currentClass().name}」及其名單、分組、成績紀錄嗎？`)) return;
    const id = state.classId; state.classes = state.classes.filter(c => c.id !== id); persistClasses();
    ['tb_state_', 'report_cards_data_', 'draw_drawn_', 'cl_zones_', 'cl_checks_', 'rs_counts_'].forEach(p => localStorage.removeItem(p + id));
    state.classId = ''; switchClass(state.classes[0].id);
  });
  $('txt-api-url').value = state.apiUrl;
  $('btn-save-api').addEventListener('click', () => {
    const u = $('txt-api-url').value.trim(); state.apiUrl = u; localStorage.setItem('gas_api_url', u); toast('💾 API 網址設定已儲存');
    if (u) testConnection(); else { setSync('offline'); $('conn-result').style.display = 'none'; }
  });
  $('btn-test-conn').addEventListener('click', () => {
    state.apiUrl = $('txt-api-url').value.trim();
    if (!state.apiUrl) { toast('⚠️ 請先貼上 API 網址'); return; } testConnection();
  });
  $('btn-save-students').addEventListener('click', async () => {
    const list = parseNames($('txt-students').value); if (!list.length) { toast('❌ 名單不可為空！'); return; }
    setStudents(list); const r = await callApi('updateStudents', 'POST', { students: list });
    toast(r ? '💾 學生名單已同步存入 Google Sheets！' : `💾 已儲存 ${list.length} 位學生（本機）`);
  });
  $('btn-load-students').addEventListener('click', () => {
    Sound.play('click'); if (!state.apiUrl) { toast('⚠️ 尚未設定雲端網址，名單僅存於本機'); return; } loadStudentsCloud();
  });
}

/* ============================================================
   啟動
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  initTabs(); initScoreboard(); initReport(); TB.init(); initSettings();
  setStudents(state.students, { persist: false }); renderTeams(); Timer.render();

  $('btn-draw').addEventListener('click', drawStudent);
  $('btn-reset-pool').addEventListener('click', () => { Sound.play('click'); resetDrawPool(); toast('🔄 抽籤池已重設'); });

  $('btn-timer-start').addEventListener('click', () => Timer.start());
  $('btn-timer-pause').addEventListener('click', () => Timer.pause());
  $('btn-timer-reset').addEventListener('click', () => Timer.reset());
  $('btn-timer-test').addEventListener('click', () => Timer.test());
  document.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => Timer.set(+b.dataset.sec)));
  $('btn-timer-custom').addEventListener('click', () => Timer.set((parseInt($('timer-custom-min').value, 10) || 0) * 60 + (parseInt($('timer-custom-sec').value, 10) || 0)));

  $('btn-make-groups').addEventListener('click', makeGroups);
  document.querySelectorAll('input[name="group-by"]').forEach(r => r.addEventListener('change', e => { $('lbl-group-num').textContent = e.target.value === 'count' ? '預期分組數量：' : '每組目標人數：'; }));

  document.querySelectorAll('.sound-card').forEach(c => c.addEventListener('click', () => Sound.play(c.dataset.sound)));

  $('btn-start-mic').addEventListener('click', () => NoiseMeter.start());
  $('btn-stop-mic').addEventListener('click', () => NoiseMeter.stop());
  $('slider-threshold').addEventListener('input', e => { $('lbl-threshold').textContent = e.target.value; $('noise-marker').style.left = e.target.value + '%'; });
  $('slider-sens').addEventListener('input', e => { $('lbl-sens').textContent = (e.target.value / 10).toFixed(1); });
  window.addEventListener('resize', () => NoiseMeter.fitCanvas());

  if (state.apiUrl) testConnection(); else setSync('offline');
});
