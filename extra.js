'use strict';
/* ============================================================
   擴充：打掃輪值 / 紅單開立通知（依賴 app.js 的 $, state, store, toast, esc, shuffle, parseNames, printHTML, Sound）
   ============================================================ */

/* ---------- 共用：讀取 Excel / CSV 的列 ---------- */
function readRows(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve([]);
    if (!window.XLSX) { toast('⚠️ Excel 解析元件尚未載入，請稍後再試（或改用貼上）'); return resolve([]); }
    const fr = new FileReader();
    fr.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        resolve(rows.map(r => (r || []).map(c => String(c == null ? '' : c).trim())).filter(r => r.some(Boolean)));
      } catch (e) { reject(e); }
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}
const todayISO = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/* ============================================================
   打掃輪值
   ============================================================ */
const CL_DEFAULT_AREAS = ['教室掃地', '教室拖地', '擦黑板／講桌', '走廊', '倒垃圾／資源回收', '整理桌椅／窗戶'];
const CL_DAYS = ['一', '二', '三', '四', '五'];
const CL = {
  areas: store.get('cl_areas', CL_DEFAULT_AREAS.map(n => ({ name: n, members: [] }))),
  roster: store.get('cl_roster', []),         // 空＝使用全班名單
  check: store.get('cl_check', {}),           // key: 區域|姓名|日 → 1(✔) / 2(✘)
  names() { return this.roster.length ? this.roster : state.students; },
  save() { store.set('cl_areas', this.areas); store.set('cl_roster', this.roster); store.set('cl_check', this.check); },
  auto() {
    const list = shuffle(this.names());
    this.areas.forEach(a => a.members = []);
    if (!this.areas.length) return;
    list.forEach((n, i) => this.areas[i % this.areas.length].members.push(n));
  },
  rotate() {
    if (this.areas.length < 2) return;
    const last = this.areas[this.areas.length - 1].members;
    for (let i = this.areas.length - 1; i > 0; i--) this.areas[i].members = this.areas[i - 1].members;
    this.areas[0].members = last;
    this.check = {};
  },
  unassigned() { const used = new Set(this.areas.flatMap(a => a.members)); return this.names().filter(n => !used.has(n)); },
  render() {
    const un = this.unassigned();
    $('cl-info').textContent = `名單 ${this.names().length} 人（${this.roster.length ? '本頁匯入名單' : '全班名單'}），區域 ${this.areas.length} 個` + (un.length ? `，尚未分配 ${un.length} 人：${un.join('、')}` : '');
    $('cl-areas').innerHTML = this.areas.map((a, i) => `<div class="x-area" data-i="${i}">
      <div class="x-area-head"><input type="text" data-name value="${esc(a.name)}"><span class="x-n">${a.members.length} 人</span><button class="btn btn-danger btn-sm" data-del style="padding:4px 8px">✕</button></div>
      <div class="x-chips">${a.members.map(n => `<span class="x-chip">${esc(n)}<button data-rm="${esc(n)}">×</button></span>`).join('') || '<span class="help-text">尚無人員</span>'}</div>
      ${un.length ? `<select data-add><option value="">＋ 加入未分配…</option>${un.map(n => `<option>${esc(n)}</option>`).join('')}</select>` : ''}
    </div>`).join('');
    const rows = [];
    this.areas.forEach(a => a.members.forEach(n => rows.push([a.name, n])));
    $('cl-check').innerHTML = rows.length ? rows.map(([an, n]) => {
      const bad = CL_DAYS.filter((_, d) => this.check[`${an}|${n}|${d}`] === 2).length;
      return `<tr><td>${esc(an)}</td><td><b>${esc(n)}</b></td>${CL_DAYS.map((_, d) => {
        const v = this.check[`${an}|${n}|${d}`]; return `<td class="x-cell" data-k="${esc(an)}|${esc(n)}|${d}">${v === 1 ? '✔' : v === 2 ? '<span style="color:#e03131">✘</span>' : ''}</td>`;
      }).join('')}<td style="text-align:center">${bad || ''}</td></tr>`;
    }).join('') : '<tr><td colspan="8" class="empty-msg">請先按「🎲 自動分配」</td></tr>';
  },
  printHTML() {
    const rows = this.areas.map(a => `<tr><td><b>${esc(a.name)}</b></td><td style="text-align:left">${a.members.map(esc).join('、') || '—'}</td></tr>`).join('');
    const days = this.areas.flatMap(a => a.members.map(n => `<tr><td>${esc(a.name)}</td><td>${esc(n)}</td>${CL_DAYS.map(() => '<td></td>').join('')}</tr>`)).join('');
    return `<div class="print-card"><div class="paper"><div class="paper-header"><h3 class="paper-title">🧹 打掃輪值表</h3><p class="paper-subtitle">${esc(RC.meta.className)} ${esc(RC.meta.term)}</p></div>
      <table class="paper-table"><thead><tr><th style="width:26%">區域</th><th>負責同學</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="paper-section-title">每日檢查</div>
      <table class="paper-table"><thead><tr><th>區域</th><th>姓名</th>${CL_DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${days}</tbody></table>
      <div class="paper-sign"><div>衛生股長：<div class="sign-line"></div></div><div>導師簽章：<div class="sign-line"></div></div></div></div></div>`;
  },
  init() {
    if (!this.areas.some(a => a.members.length) && this.names().length) this.auto();
    const box = $('cl-areas');
    $('cl-import-btn').addEventListener('click', () => { const b = $('cl-import-box'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; });
    $('cl-import-file').addEventListener('change', async e => {
      try { const rows = await readRows(e.target.files[0]); if (rows.length) $('cl-import-text').value = rows.map(r => r[0]).filter(Boolean).join('\n'); }
      catch (err) { toast('❌ 檔案讀取失敗'); } e.target.value = '';
    });
    $('cl-import-ok').addEventListener('click', () => {
      const list = [...new Set(parseNames($('cl-import-text').value))]; if (!list.length) { toast('❌ 名單是空的'); return; }
      this.roster = list; this.auto(); this.save(); this.render(); $('cl-import-box').style.display = 'none'; toast(`📥 已匯入 ${list.length} 位並自動分配`);
    });
    $('cl-use-all').addEventListener('click', () => { this.roster = []; this.auto(); this.save(); this.render(); toast('👥 已改用全班名單'); });
    $('cl-add-area').addEventListener('click', () => { this.areas.push({ name: `新區域${this.areas.length + 1}`, members: [] }); this.save(); this.render(); });
    $('cl-auto').addEventListener('click', () => { Sound.play('click'); this.auto(); this.check = {}; this.save(); this.render(); toast('🎲 已重新自動分配'); });
    $('cl-rotate').addEventListener('click', () => { Sound.play('click'); this.rotate(); this.save(); this.render(); toast('🔁 已輪替到下一區（打卡已清空）'); });
    $('cl-print').addEventListener('click', () => { Sound.play('click'); printHTML(this.printHTML()); });
    $('cl-clear-check').addEventListener('click', () => { this.check = {}; this.save(); this.render(); });
    box.addEventListener('input', e => { if (e.target.dataset.name === undefined) return; this.areas[+e.target.closest('.x-area').dataset.i].name = e.target.value; this.save(); });
    box.addEventListener('change', e => {
      if (e.target.dataset.add === undefined || !e.target.value) return;
      this.areas[+e.target.closest('.x-area').dataset.i].members.push(e.target.value); this.save(); this.render();
    });
    box.addEventListener('click', e => {
      const a = this.areas[+(e.target.closest('.x-area') || { dataset: { i: -1 } }).dataset.i]; if (!a) return;
      if (e.target.closest('[data-del]')) { this.areas.splice(this.areas.indexOf(a), 1); this.save(); this.render(); }
      else if (e.target.dataset.rm !== undefined) { a.members = a.members.filter(n => n !== e.target.dataset.rm); this.save(); this.render(); }
    });
    $('cl-check').addEventListener('click', e => {
      const c = e.target.closest('.x-cell'); if (!c) return; const k = c.dataset.k, v = this.check[k] || 0;
      if (v === 0) this.check[k] = 1; else if (v === 1) this.check[k] = 2; else delete this.check[k];
      this.save(); this.render();
    });
    this.render();
  }
};

/* ============================================================
   紅單開立通知
   ============================================================ */
const RS = {
  meta: Object.assign({ school: '', className: '', teacher: '', reason: '', note: '' }, store.get('rs_meta', {})),
  slips: store.get('rs_slips', []),
  save() { store.set('rs_meta', this.meta); store.set('rs_slips', this.slips); },
  /* 解析一個「對象」token：座號 / 範圍 / 姓名 */
  resolve(tok) {
    tok = tok.trim(); if (!tok) return [];
    const list = state.students;
    const rg = tok.match(/^(\d+)\s*[-~－～到至]\s*(\d+)$/);
    if (rg) { const a = +rg[1], b = +rg[2], out = []; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(this.byNo(i)); return out; }
    if (/^\d+$/.test(tok)) return [this.byNo(+tok)];
    return [{ no: list.indexOf(tok) >= 0 ? list.indexOf(tok) + 1 : '', name: tok }];
  },
  byNo(n) { const nm = state.students[n - 1]; return { no: n, name: nm || `（座號${n}查無此人）`, missing: !nm }; },
  /* 一行：<對象清單> [事由]；對象以逗號/頓號分隔，第一個空白後為事由 */
  parseLine(line, defReason) {
    line = line.trim(); if (!line) return [];
    let who = line, reason = '';
    const m = line.match(/^(\S+?)(?:[\s：:]+(.+))?$/);
    if (m) { who = m[1]; reason = (m[2] || '').trim(); }
    return who.split(/[,，、;；]+/).flatMap(t => this.resolve(t)).map(s => ({ ...s, reason: reason || defReason }));
  },
  generate(lines) {
    const def = $('rs-reason').value.trim(); const out = [];
    lines.forEach(l => this.parseLine(l, def).forEach(s => out.push(s)));
    const bad = out.filter(s => s.missing); const good = out.filter(s => !s.missing);
    good.forEach(s => this.slips.push({ no: s.no, name: s.name, reason: s.reason, note: $('rs-note').value.trim(), date: $('rs-date').value || todayISO(), id: uid() }));
    this.save(); this.render();
    toast(`🟥 已產生 ${good.length} 張紅單` + (bad.length ? `，${bad.length} 筆找不到學生已略過` : ''));
  },
  slipHTML(s) {
    const d = new Date((s.date || todayISO()) + 'T00:00:00'); const dt = `${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    return `<div class="rs-slip"><div class="rs-head">🟥 紅單開立通知</div>
      <div class="rs-sub">${esc(this.meta.school)} ${esc(this.meta.className)}</div>
      <table class="rs-tb"><tr><th>學生</th><td>${s.no ? esc(s.no) + ' 號　' : ''}<b>${esc(s.name)}</b></td></tr>
      <tr><th>事由</th><td>${esc(s.reason || '（請填寫）')}</td></tr>
      <tr><th>日期</th><td>${dt}</td></tr>
      <tr><th>開立人</th><td>${esc(this.meta.teacher)}</td></tr>
      ${s.note ? `<tr><th>備註</th><td>${esc(s.note)}</td></tr>` : ''}</table>
      <div class="rs-msg">親愛的家長您好：貴子弟今日有上述情形，煩請協助提醒並督促改善，謝謝您。</div>
      <div class="rs-sign">家長簽章：<span class="sign-line"></span></div></div>`;
  },
  pagesHTML(list) {
    const pages = []; for (let i = 0; i < list.length; i += 4) pages.push(list.slice(i, i + 4));
    return pages.map(p => `<div class="print-card"><div class="rs-grid">${p.map(s => this.slipHTML(s)).join('')}</div></div>`).join('');
  },
  render() {
    $('rs-count').textContent = this.slips.length ? `（共 ${this.slips.length} 張）` : '';
    $('rs-preview').innerHTML = this.slips.length
      ? `<div class="rs-grid rs-grid-prev">${this.slips.map((s, i) => `<div class="rs-wrap">${this.slipHTML(s)}<button class="btn btn-danger btn-sm rs-x" data-i="${i}">✕</button></div>`).join('')}</div>`
      : '<div class="empty-preview">尚未產生紅單</div>';
  },
  init() {
    $('rs-school').value = this.meta.school || RC.meta.school || ''; $('rs-class').value = this.meta.className || RC.meta.className || '';
    $('rs-teacher').value = this.meta.teacher; $('rs-date').value = todayISO(); $('rs-reason').value = this.meta.reason; $('rs-note').value = this.meta.note;
    this.meta.school = $('rs-school').value; this.meta.className = $('rs-class').value;
    [['rs-school', 'school'], ['rs-class', 'className'], ['rs-teacher', 'teacher'], ['rs-reason', 'reason'], ['rs-note', 'note']].forEach(([id, k]) =>
      $(id).addEventListener('input', e => { this.meta[k] = e.target.value; this.save(); if (['school', 'className', 'teacher'].includes(k)) this.render(); }));
    $('rs-gen').addEventListener('click', () => {
      Sound.play('click'); const lines = $('rs-text').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) { toast('⚠️ 請先輸入座號或姓名，或匯入檔案'); return; }
      this.generate(lines);
    });
    $('rs-file').addEventListener('change', async e => {
      try {
        const rows = await readRows(e.target.files[0]); if (!rows.length) return;
        const skip = /^(座號|號碼|姓名|學生|name|no)/i.test(rows[0][0] || '') ? 1 : 0;
        $('rs-text').value = rows.slice(skip).map(r => r[1] ? `${r[0]} ${r[1]}` : r[0]).join('\n'); toast(`📥 已匯入 ${rows.length - skip} 筆，請按「產生紅單」`);
      } catch (err) { toast('❌ 檔案讀取失敗'); } e.target.value = '';
    });
    $('rs-all').addEventListener('click', () => { $('rs-text').value = state.students.map((_, i) => i + 1).join(','); toast('👥 已帶入全班座號'); });
    $('rs-clear').addEventListener('click', () => { if (!this.slips.length || !confirm('確定清空所有紅單？')) return; this.slips = []; this.save(); this.render(); });
    $('rs-print').addEventListener('click', () => { Sound.play('click'); if (!this.slips.length) { toast('⚠️ 尚無紅單可列印'); return; } printHTML(this.pagesHTML(this.slips)); });
    $('rs-preview').addEventListener('click', e => { const b = e.target.closest('.rs-x'); if (!b) return; this.slips.splice(+b.dataset.i, 1); this.save(); this.render(); });
    this.render();
  }
};

window.addEventListener('DOMContentLoaded', () => { CL.init(); RS.init(); });
