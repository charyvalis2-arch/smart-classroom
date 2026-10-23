'use strict';
/* ============================================================
   翠屏老師的國文課：打掃輪值（內掃／外掃區塊＋週曆打卡＋Word）與紅單（導師版／任課老師版）
   依賴 app.js：$, state, store, toast, esc, uid, parseNames, printHTML, Sound, currentClass, switchClass
   注意：負責人以「座號」存放，姓名只在瀏覽器依班級名單對照顯示，不會寫進程式碼或倉庫。
   ============================================================ */
const pad2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
const todayISO = () => iso(new Date());
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
const nameOf = no => (typeof no === 'number' ? (state.students[no - 1] || '') : '');
const who = m => typeof m === 'number' ? (nameOf(m) ? `${m} ${nameOf(m)}` : `${m}`) : String(m);
const whoList = arr => (arr || []).map(who).join('、');
const parseWho = t => t.split(/[\s,，、;；]+/).filter(Boolean).map(x => { if (/^\d+$/.test(x)) return +x; const i = state.students.indexOf(x); return i >= 0 ? i + 1 : x; });
const downloadBlob = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
const needDocx = () => { if (!window.docx) { toast('⚠️ Word 元件尚未載入，請重新整理後再試'); return false; } return true; };
const DX_FONT = { ascii: 'Arial', hAnsi: 'Arial', cs: 'Arial', eastAsia: 'Microsoft JhengHei' };

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
    fr.onerror = () => reject(fr.error); fr.readAsArrayBuffer(file);
  });
}

/* ============================================================
   一、打掃輪值
   ============================================================ */
const NOTE_A = '拖地的人皆需使用水桶，利用擠水器將拖把擰乾，拖把不可太溼。';
const NOTE_B = '拖地的人皆需使用擠水器將拖把擰乾，拖把不可太溼。';
const NOTE_C = '打掃完畢務必請衛生股長檢查，通過則記O；若未通過或未給衛生股長檢查者，則記X。';
const COLSET = { ame: ['早', '中', '備註'], amn: ['早', '中', '晚'] };
/* 範本：區塊名稱、工作項目、（第一個班的）負責人座號 */
const ZONE_TPL = {
  inner: { label: '內掃區（教室）', name: '內掃區', cols: 'ame', notes: [NOTE_A, NOTE_C], checker: [28], rows: [
    ['掃地+拖地', '1、2、3排+講台前方', [4]], ['掃地+拖地', '走道3+4、5排+教室後方', [19]], ['掃地+拖地', '陽台掃+拖+洗手台', [8]], ['掃地+拖地', '走廊掃+拖', [11]], ['掃地+拖地', '學習角掃+拖', [9]],
    ['櫃子', '電腦桌+餐桌+學習角櫃+座位後櫃', [17]], ['', '黑板*2', [25]], ['', '黑板*2', [23]],
    ['', '兩側窗戶(走廊前門+1.5窗)', [12]], ['', '兩側窗戶(走廊後門+1.5窗)', [5]], ['', '擦窗戶(教室窗)', [7]], ['', '擦窗戶(教室陽台窗)', [22]],
    ['', '排掃具', [16]], ['', '資源回收', [21]], ['', '垃圾', [14]]] },
  outer1: { label: '外掃區①（體育辦公室、資優教室…）', name: '外掃區①', cols: 'ame', notes: [NOTE_B, NOTE_C], checker: [6], rows: [
    ['', '體育辦公室掃地+拖地', [15]], ['', '體育辦公室倒垃圾', [10]], ['', '體育辦公室資源回收', [3]],
    ['', '資優教室掃地＋拖地＋後面玻璃', [26]], ['', '資優教室掃地＋拖地＋後面玻璃', [29]], ['', '客語教室＊2掃地+拖地', [18]],
    ['', '資優語言教室黑板', [20]], ['', '資優語言教室黑板', [13]], ['', '1樓廣場走廊2', [1, 2]]] },
  outer2: { label: '外掃區②（辦公室、走廊、樓梯…）', name: '外掃區②', cols: 'amn', notes: [NOTE_B, NOTE_C], checker: [], rows: [
    ['', '辦公室掃地', []], ['', '辦公室拖地', []], ['', '中午抬餐+垃圾+回收', []], ['', '辦公室外走廊掃地', []], ['', '辦公室外走廊拖地', []],
    ['', '電腦教室前走廊1 掃+拖', []], ['', '電腦教室前走廊2 掃+拖', []], ['', '兩側樓梯掃地', []], ['', '兩側樓梯拖地', []],
    ['', '兩處走道 掃地', []], ['', '中廊右半 掃+拖', []], ['', '中廊左半 掃+拖', []], ['', '洗手台+樓梯間的窗戶、鏡子', []]] },
  blank: { label: '空白區塊（自行設定）', name: '新區塊', cols: 'ame', notes: [NOTE_B, NOTE_C], checker: [], rows: [['', '', []], ['', '', []], ['', '', []]] }
};
const makeZone = (key, seed) => {
  const t = ZONE_TPL[key];
  return { id: uid(), name: t.name, checker: seed ? t.checker.slice() : [], cols: t.cols, notes: t.notes.slice(),
    items: t.rows.map(([g, n, m]) => ({ g, n, m: seed ? m.slice() : [] })) };
};

const CL = {
  zones: [], checks: {}, holidays: store.get('cl_holidays', {}), semStart: store.get('cl_sem', '2026-08-31'),
  cur: '', week: iso(mondayOf(new Date())), calMonth: null,
  k(n) { return n + '_' + state.classId; },
  load() {
    const first = state.classId === 'c1';  // 只有最初的 711 班套用範本的座號分配
    this.zones = store.get(this.k('cl_zones'), null);
    if (!Array.isArray(this.zones) || !this.zones.length) { this.zones = ['inner', 'outer1', 'outer2'].map(t => makeZone(t, first)); }
    this.checks = store.get(this.k('cl_checks'), {});
    if (!this.zones.some(z => z.id === this.cur)) this.cur = this.zones[0].id;
    this.calMonth = fromISO(this.week); this.calMonth.setDate(1);
  },
  save() { store.set(this.k('cl_zones'), this.zones); store.set(this.k('cl_checks'), this.checks); store.set('cl_holidays', this.holidays); store.set('cl_sem', this.semStart); },
  z() { return this.zones.find(x => x.id === this.cur) || this.zones[0]; },
  weekNo(monISO) { const base = mondayOf(fromISO(this.semStart)); return Math.round((fromISO(monISO) - base) / 6048e5) + 1; },
  vals(zid) { return ((this.checks[this.week] || {})[zid]) || {}; },
  setVal(zid, key, v) {
    const w = this.checks[this.week] = this.checks[this.week] || {}, o = w[zid] = w[zid] || {};
    if (v === '' || v == null) delete o[key]; else o[key] = v; this.save();
  },
  days(monISO) { const m = fromISO(monISO); return [0, 1, 2, 3, 4].map(i => addDays(m, i)); },

  /* ----- 週表 HTML（畫面與列印共用）----- */
  sheetHTML(z, o = {}) {
    const { blank = false, interactive = false } = o, monISO = o.week || this.week, days = this.days(monISO), vals = blank ? {} : this.vals(z.id);
    const cols = COLSET[z.cols] || COLSET.ame, hasG = z.items.some(i => i.g);
    const spans = z.items.map((it, i) => { if (!hasG || !it.g) return 0; if (i > 0 && z.items[i - 1].g === it.g) return -1; let n = 1; while (z.items[i + n] && z.items[i + n].g === it.g) n++; return n; });
    const wk = blank ? '　　' : this.weekNo(monISO);
    const head = `<tr><th colspan="${hasG ? 2 : 1}" rowspan="2">工作項目</th><th rowspan="2">負責人</th>${days.map((d, di) => {
      const hol = !blank && this.holidays[iso(d)];
      const lab = blank ? '' : `${WD[d.getDay()]} ${md(d)}${hol ? ' 休' : ''}`;
      return `<th colspan="3" class="cl-dh ${hol ? 'hol' : ''}" ${interactive ? `data-day="${di}" title="點一下標記／取消放假"` : ''}>${lab}</th>`;
    }).join('')}</tr><tr>${days.map(() => cols.map(c => `<th class="cl-sub">${c}</th>`).join('')).join('')}</tr>`;
    const body = z.items.map((it, i) => {
      const gcell = !hasG ? '' : (spans[i] > 0 ? `<td class="cl-g" rowspan="${spans[i]}">${esc(it.g)}</td>` : (spans[i] === 0 ? '' : ''));
      const ncell = `<td class="cl-n" ${hasG && !it.g ? 'colspan="2"' : ''}>${esc(it.n)}</td>`;
      const cells = days.map((d, di) => { const hol = !blank && this.holidays[iso(d)]; return cols.map((c, si) => {
        const key = `${i}|${di}|${si}`, v = vals[key] || '', isNote = z.cols === 'ame' && si === 2;
        if (hol) return '<td class="cl-hol"></td>';
        if (isNote) return interactive ? `<td class="cl-note" contenteditable="true" data-k="${key}">${esc(v)}</td>` : `<td class="cl-note">${esc(v)}</td>`;
        return `<td class="cl-c ${v === 'X' ? 'x' : v === 'O' ? 'o' : ''}" ${interactive ? `data-k="${key}"` : ''}>${esc(v)}</td>`;
      }).join(''); }).join('');
      return `<tr>${gcell}${ncell}<td class="cl-m">${esc(whoList(it.m))}</td>${cells}</tr>`;
    }).join('');
    const notes = (z.notes || []).filter(Boolean).map(n => `<div>＊ ${esc(n)}</div>`).join('');
    return `<div class="cl-sheet-wrap"><div class="cl-title"><b>${esc(currentClass().name)} 打掃工作檢查表</b><span>第 ${wk} 週${blank ? '' : `　(${md(days[0])}～${md(days[4])})`}</span></div>
      <table class="cl-sheet"><thead><tr><th colspan="${(hasG ? 3 : 2) + 15}" class="cl-cap">${esc(z.name)}　　檢查者：${esc(whoList(z.checker))}</th></tr>${head}</thead><tbody>${body}</tbody></table>
      <div class="cl-foot">${notes}</div></div>`;
  },

  /* ----- 畫面 ----- */
  renderCal() {
    const m = this.calMonth, first = mondayOf(new Date(m.getFullYear(), m.getMonth(), 1)), today = todayISO();
    $('cl-cal-title').textContent = `${m.getFullYear()} 年 ${m.getMonth() + 1} 月`;
    let h = '<tr><th>週</th>' + ['一', '二', '三', '四', '五', '六', '日'].map(x => `<th>${x}</th>`).join('') + '</tr>';
    for (let r = 0; r < 6; r++) {
      const mon = addDays(first, r * 7); if (r >= 4 && mon.getMonth() !== m.getMonth() && addDays(mon, 0) > new Date(m.getFullYear(), m.getMonth() + 1, 0)) break;
      const sel = iso(mon) === this.week, wn = this.weekNo(iso(mon));
      h += `<tr class="${sel ? 'sel' : ''}"><td class="wn">${wn >= 1 ? wn : ''}</td>` + [0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(mon, i), s = iso(d);
        return `<td class="d ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${s === today ? 'today' : ''} ${this.holidays[s] ? 'hol' : ''}" data-d="${s}">${d.getDate()}</td>`; }).join('') + '</tr>';
    }
    $('cl-cal').innerHTML = h;
    const mon = fromISO(this.week), n = this.weekNo(this.week);
    $('cl-week-label').innerHTML = `<b>第 ${n} 週</b>　${md(mon)} ～ ${md(addDays(mon, 4))}`;
    $('cl-sem-start').value = this.semStart;
  },
  renderTabs() {
    $('cl-zone-tabs').innerHTML = this.zones.map(z => `<button class="cl-tab ${z.id === this.cur ? 'on' : ''}" data-id="${z.id}">${esc(z.name || '未命名')}</button>`).join('');
    const z = this.z();
    $('cl-z-name').value = z.name; $('cl-z-checker').value = (z.checker || []).map(x => x).join('、'); $('cl-z-cols').value = z.cols; $('cl-z-notes').value = (z.notes || []).join('\n');
    $('cl-z-checker-name').textContent = z.checker && z.checker.length ? `（${whoList(z.checker)}）` : '';
  },
  renderItems() {
    const z = this.z();
    $('cl-items').innerHTML = z.items.map((it, i) => `<tr data-i="${i}"><td class="idx">${i + 1}</td>
      <td><input type="text" data-f="g" value="${esc(it.g)}" placeholder="（可空白）"></td>
      <td><input type="text" data-f="n" value="${esc(it.n)}" placeholder="工作項目"></td>
      <td><input type="text" data-f="m" value="${esc((it.m || []).join('、'))}" placeholder="座號，例：4、19"><div class="help-text nm">${esc(whoList(it.m))}</div></td>
      <td class="ops"><button data-op="up" title="上移">↑</button><button data-op="down" title="下移">↓</button><button data-op="del" title="刪除">✕</button></td></tr>`).join('');
  },
  renderSheet() {
    const z = this.z(); $('cl-sheet-wrap').innerHTML = this.sheetHTML(z, { interactive: true });
    const vals = this.vals(z.id), bad = {};
    z.items.forEach((it, i) => (it.m || []).forEach(m => { let n = 0; Object.keys(vals).forEach(k => { const [ii, , s] = k.split('|'); if (+ii === i && vals[k] === 'X' && !(z.cols === 'ame' && +s === 2)) n++; }); if (n) bad[who(m)] = (bad[who(m)] || 0) + n; }));
    const ks = Object.keys(bad);
    $('cl-x-summary').innerHTML = ks.length ? `本週 ✘：${ks.map(k => `<b>${esc(k)}</b> ×${bad[k]}`).join('　')}` : '本週尚無 ✘ 紀錄';
  },
  renderAll() { this.renderCal(); this.renderTabs(); this.renderItems(); this.renderSheet(); },

  /* ----- Word ----- */
  dxCell(text, o = {}) {
    const d = window.docx, lines = String(text == null ? '' : text).split('\n');
    return new d.TableCell({ width: { size: o.w, type: d.WidthType.DXA }, columnSpan: o.span, rowSpan: o.rowSpan, verticalAlign: d.VerticalAlign.CENTER,
      shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, margins: { top: 25, bottom: 25, left: 40, right: 40 },
      children: lines.map(l => new d.Paragraph({ alignment: o.left ? d.AlignmentType.LEFT : d.AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new d.TextRun({ text: l, bold: !!o.bold, size: o.size || 18, font: DX_FONT })] })) });
  },
  dxSheet(z, o = {}) {
    const d = window.docx, { blank = false } = o, monISO = o.week || this.week, days = this.days(monISO), vals = blank ? {} : this.vals(z.id);
    const cols = COLSET[z.cols] || COLSET.ame, hasG = z.items.some(i => i.g), amn = z.cols === 'amn';
    const wG = 480, wN = hasG ? 1900 : 2380, wM = 1250, dayW = amn ? [430, 430, 430] : [380, 380, 640];
    const widths = [...(hasG ? [wG] : []), wN, wM, ...Array(5).fill(dayW).flat()], total = widths.reduce((a, b) => a + b, 0);
    const spans = z.items.map((it, i) => { if (!hasG || !it.g) return 0; if (i > 0 && z.items[i - 1].g === it.g) return -1; let n = 1; while (z.items[i + n] && z.items[i + n].g === it.g) n++; return n; });
    const C = (t, w, x = {}) => this.dxCell(t, { w, ...x });
    const rows = [];
    rows.push(new d.TableRow({ children: [C(`${z.name}　　檢查者：${whoList(z.checker)}`, total, { span: widths.length, bold: true, size: 22 })] }));
    rows.push(new d.TableRow({ tableHeader: true, children: [C('工作項目', wG * (hasG ? 1 : 0) + wN, { span: hasG ? 2 : 1, rowSpan: 2, bold: true, fill: 'F2F2F2' }), C('負責人', wM, { rowSpan: 2, bold: true, fill: 'F2F2F2' }),
      ...days.map(dd => { const hol = !blank && this.holidays[iso(dd)]; return C(blank ? '' : `${WD[dd.getDay()]} ${md(dd)}${hol ? ' 休' : ''}`, dayW[0] + dayW[1] + dayW[2], { span: 3, bold: true, size: 16, fill: 'F2F2F2' }); })] }));
    rows.push(new d.TableRow({ tableHeader: true, children: days.flatMap(() => cols.map((c, si) => C(c, dayW[si], { bold: true, size: 15, fill: 'F2F2F2' }))) }));
    z.items.forEach((it, i) => {
      const cells = [];
      if (hasG) { if (spans[i] > 0) cells.push(C(it.g, wG, { rowSpan: spans[i], bold: true, size: 18 })); if (!it.g) cells.push(C(it.n, wG + wN, { span: 2, size: 17 })); else cells.push(C(it.n, wN, { size: 17 })); }
      else cells.push(C(it.n, wN, { size: 17 }));
      cells.push(C(whoList(it.m), wM, { size: 17 }));
      days.forEach((dd, di) => cols.forEach((c, si) => { const hol = !blank && this.holidays[iso(dd)], v = hol ? '' : (vals[`${i}|${di}|${si}`] || ''); cells.push(C(v, dayW[si], { size: (!amn && si === 2) ? 13 : 18, bold: v === 'X', fill: hol ? 'E5E5E5' : undefined })); }));
      rows.push(new d.TableRow({ cantSplit: true, height: { value: 640, rule: d.HeightRule.ATLEAST }, children: cells }));
    });
    const wk = blank ? '　　' : this.weekNo(monISO);
    const kids = [
      new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 40 }, children: [new d.TextRun({ text: `${currentClass().name} 打掃工作檢查表`, bold: true, size: 32, font: DX_FONT })] }),
      new d.Paragraph({ alignment: d.AlignmentType.RIGHT, spacing: { after: 100 }, children: [new d.TextRun({ text: `第 ${wk} 週${blank ? '' : `　（${md(days[0])}～${md(days[4])}）`}`, bold: true, size: 22, font: DX_FONT })] }),
      new d.Table({ width: { size: total, type: d.WidthType.DXA }, columnWidths: widths, layout: d.TableLayoutType.FIXED, rows }),
      new d.Paragraph({ spacing: { before: 80 }, children: [] }),
      ...(z.notes || []).filter(Boolean).map(n => new d.Paragraph({ spacing: { after: 20 }, children: [new d.TextRun({ text: `＊ ${n}`, size: 18, font: DX_FONT })] }))];
    return kids;
  },
  async word(zones, blank, name) {
    if (!needDocx()) return; const d = window.docx;
    const doc = new d.Document({ styles: { default: { document: { run: { font: DX_FONT, size: 18 } } } },
      sections: zones.map(z => ({ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } }, children: this.dxSheet(z, { blank }) })) });
    downloadBlob(await d.Packer.toBlob(doc), name); toast('📄 Word 已產生，請查看下載資料夾');
  },
  csv() {
    const rows = [['週次', '週一日期', '區塊', '工作項目', '負責人', '星期', '欄位', '紀錄']];
    Object.keys(this.checks).sort().forEach(w => this.zones.forEach(z => { const v = (this.checks[w] || {})[z.id] || {};
      Object.keys(v).forEach(k => { const [i, di, si] = k.split('|').map(Number), it = z.items[i]; if (!it) return;
        rows.push([this.weekNo(w), w, z.name, it.n, whoList(it.m), '週' + WD[(di + 1) % 7], (COLSET[z.cols] || COLSET.ame)[si], v[k]]); }); }));
    const txt = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadBlob(new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8' }), `${currentClass().name}_打掃打卡紀錄.csv`);
  },

  init() {
    this.load(); const root = $('tab-cleaning');
    const go = w => { this.week = iso(mondayOf(typeof w === 'string' ? fromISO(w) : w)); this.calMonth = fromISO(this.week); this.calMonth.setDate(1); this.renderCal(); this.renderSheet(); };
    $('cl-cal-prev').addEventListener('click', () => { this.calMonth.setMonth(this.calMonth.getMonth() - 1); this.renderCal(); });
    $('cl-cal-next').addEventListener('click', () => { this.calMonth.setMonth(this.calMonth.getMonth() + 1); this.renderCal(); });
    $('cl-cal-today').addEventListener('click', () => go(new Date()));
    $('cl-week-prev').addEventListener('click', () => go(addDays(fromISO(this.week), -7)));
    $('cl-week-next').addEventListener('click', () => go(addDays(fromISO(this.week), 7)));
    $('cl-cal').addEventListener('click', e => { const c = e.target.closest('.d'); if (c) go(c.dataset.d); });
    $('cl-sem-start').addEventListener('change', e => { if (e.target.value) { this.semStart = e.target.value; this.save(); this.renderCal(); this.renderSheet(); } });
    // 區塊
    $('cl-zone-tabs').addEventListener('click', e => { const b = e.target.closest('.cl-tab'); if (!b) return; this.cur = b.dataset.id; this.renderTabs(); this.renderItems(); this.renderSheet(); });
    $('cl-zone-add').addEventListener('click', () => {
      const z = makeZone($('cl-tpl').value, false); this.zones.push(z); this.cur = z.id; this.save(); this.renderAll(); toast(`➕ 已新增「${z.name}」，請設定負責人`);
    });
    $('cl-z-dup').addEventListener('click', () => { const z = JSON.parse(JSON.stringify(this.z())); z.id = uid(); z.name += '（複製）'; this.zones.push(z); this.cur = z.id; this.save(); this.renderAll(); });
    $('cl-z-del').addEventListener('click', () => {
      if (this.zones.length <= 1) { toast('⚠️ 至少保留一個區塊'); return; } const z = this.z(); if (!confirm(`確定刪除區塊「${z.name}」？（含各週打卡紀錄）`)) return;
      this.zones = this.zones.filter(x => x.id !== z.id); Object.values(this.checks).forEach(w => delete w[z.id]); this.cur = this.zones[0].id; this.save(); this.renderAll();
    });
    const zf = (id, fn) => $(id).addEventListener('input', e => { fn(this.z(), e.target.value); this.save(); });
    zf('cl-z-name', (z, v) => { z.name = v; const b = $('cl-zone-tabs').querySelector('.cl-tab.on'); if (b) b.textContent = v || '未命名'; this.renderSheet(); });
    zf('cl-z-checker', (z, v) => { z.checker = parseWho(v); $('cl-z-checker-name').textContent = z.checker.length ? `（${whoList(z.checker)}）` : ''; this.renderSheet(); });
    zf('cl-z-notes', (z, v) => { z.notes = v.split('\n').map(s => s.trim()).filter(Boolean); this.renderSheet(); });
    $('cl-z-cols').addEventListener('change', e => { this.z().cols = e.target.value; this.save(); this.renderSheet(); });
    $('cl-z-rotate').addEventListener('click', () => {
      const z = this.z(), ms = z.items.map(i => i.m || []); if (z.items.length < 2) return;
      ms.unshift(ms.pop()); z.items.forEach((it, i) => it.m = ms[i]); this.save(); this.renderItems(); this.renderSheet(); toast('🔁 已將負責人往下一項輪替');
    });
    // 項目編輯
    $('cl-item-add').addEventListener('click', () => { this.z().items.push({ g: '', n: '', m: [] }); this.save(); this.renderItems(); this.renderSheet(); });
    $('cl-items').addEventListener('input', e => {
      const f = e.target.dataset.f; if (!f) return; const it = this.z().items[+e.target.closest('tr').dataset.i];
      if (f === 'm') { it.m = parseWho(e.target.value); e.target.nextElementSibling.textContent = whoList(it.m); } else it[f] = e.target.value;
      this.save(); this.renderSheet();
    });
    $('cl-items').addEventListener('click', e => {
      const b = e.target.closest('[data-op]'); if (!b) return; const z = this.z(), i = +b.closest('tr').dataset.i, op = b.dataset.op;
      if (op === 'del') z.items.splice(i, 1); else { const j = op === 'up' ? i - 1 : i + 1; if (j < 0 || j >= z.items.length) return; [z.items[i], z.items[j]] = [z.items[j], z.items[i]]; }
      this.save(); this.renderItems(); this.renderSheet();
    });
    // 名單匯入
    $('cl-import-btn').addEventListener('click', () => { const b = $('cl-import-box'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; });
    $('cl-import-file').addEventListener('change', async e => {
      try {
        const rows = await readRows(e.target.files[0]); if (!rows.length) return;
        const skip = /^(座號|號碼|姓名|學生|name|no)/i.test(rows[0][0] || '') || /^(姓名|名字)/.test(rows[0][1] || '') ? 1 : 0;
        const two = rows.slice(skip).every(r => /^\d+$/.test(r[0]) && r[1]);
        $('cl-import-text').value = rows.slice(skip).map(r => two ? r[1] : r[0]).join('\n');
      } catch (err) { toast('❌ 檔案讀取失敗'); } e.target.value = '';
    });
    $('cl-import-ok').addEventListener('click', () => {
      const list = parseNames($('cl-import-text').value); if (!list.length) { toast('❌ 名單是空的'); return; }
      setStudents(list); $('cl-import-box').style.display = 'none'; this.renderAll(); toast(`📥 已匯入 ${currentClass().name} 名單 ${list.length} 人（依輸入順序＝座號 1、2、3…）`);
    });
    // 打卡
    $('cl-sheet-wrap').addEventListener('click', e => {
      const th = e.target.closest('.cl-dh'); if (th && th.dataset.day !== undefined) {
        const s = iso(addDays(fromISO(this.week), +th.dataset.day)); if (this.holidays[s]) delete this.holidays[s]; else this.holidays[s] = true; this.save(); this.renderCal(); this.renderSheet(); return;
      }
      const c = e.target.closest('.cl-c'); if (!c) return; const key = c.dataset.k, cur = this.vals(this.z().id)[key] || '', nx = cur === '' ? 'O' : cur === 'O' ? 'X' : '';
      this.setVal(this.z().id, key, nx); Sound.play(nx === 'X' ? 'wrong' : 'click'); this.renderSheet();
    });
    $('cl-sheet-wrap').addEventListener('input', e => { const c = e.target.closest('.cl-note'); if (c) this.setVal(this.z().id, c.dataset.k, c.textContent.trim()); });
    $('cl-clear-week').addEventListener('click', () => { if (!confirm('確定清空本週這個區塊的打卡？')) return; if (this.checks[this.week]) delete this.checks[this.week][this.z().id]; this.save(); this.renderSheet(); });
    // 列印 / 下載
    const pg = (z, blank) => `<div class="cl-print-page">${this.sheetHTML(z, { blank })}</div>`;
    $('cl-print').addEventListener('click', () => { Sound.play('click'); printHTML(pg(this.z(), false)); });
    $('cl-print-all').addEventListener('click', () => { Sound.play('click'); printHTML(this.zones.map(z => pg(z, false)).join('')); });
    $('cl-print-blank').addEventListener('click', () => { Sound.play('click'); printHTML(pg(this.z(), true)); });
    const fn = s => `${currentClass().name}_打掃工作檢查表_${s}.docx`;
    $('cl-dl-zone').addEventListener('click', () => this.word([this.z()], false, fn(`${this.z().name}_第${this.weekNo(this.week)}週`)));
    $('cl-dl-all').addEventListener('click', () => this.word(this.zones, false, fn(`全部區塊_第${this.weekNo(this.week)}週`)));
    $('cl-dl-blank').addEventListener('click', () => this.word([this.z()], true, fn(`${this.z().name}_空白`)));
    $('cl-dl-blank-all').addEventListener('click', () => this.word(this.zones, true, fn('全部區塊_空白')));
    $('cl-dl-csv').addEventListener('click', () => this.csv());
    this.renderAll();
  }
};

/* ============================================================
   二、紅單（導師版：校園生活、學習狀況通知單／任課老師版：國文作業通知單）
   ============================================================ */
const LIFE_ITEMS = [
  { t: '學習態度不佳(例：聊天、傳紙條、睡覺、不聽勸導)' },
  { t: '上課做其他事（{x}）', key: 'doing', ph: '做什麼事' },
  { t: '{x} 作業或作品未於規定時間完成、繳交', key: 'hw', ph: '科目／作業' },
  { t: '上課用品未帶' }, { t: '服裝儀容不符合規定' }, { t: '個人座位及周圍、抽屜、置物櫃、桌面不整齊' }, { t: '打掃不確實、玩耍、不認真' },
  { t: '說粗鄙的話或性別不尊重的笑話（已多次提醒）' },
  { t: '大聲喧嘩或發出怪聲，如：{x}（已多次提醒）', key: 'noise', ph: '例：怪聲' },
  { t: '聯絡簿書寫不完整、多日未簽名、拖欠回條' }, { t: '未寫札記' }, { t: '教室、走廊奔跑' },
  { t: '其他：{x}', key: 'other', ph: '其他說明' }
];
const HW_ITEMS = ['習作', '講義', '學習單', '作文', '考卷訂正'];
const BLANK_U = '＿＿＿＿＿';
const SIGN = '＿＿＿＿＿＿＿＿＿＿＿＿＿＿';
const minguo = s => { const d = fromISO(s); return `${d.getFullYear() - 1911}.${d.getMonth() + 1}.${d.getDate()}`; };
const mdw = s => { const d = fromISO(s); return `${d.getMonth() + 1}月${d.getDate()}日（週${WD[d.getDay()]}）`; };

const RS = {
  slips: [], counts: {},
  cfg: Object.assign({ subject: '國文', teacher: '陳翠屏', phrase: '未確實訂正或完成', tpl: 'life' }, store.get('rs_cfg', {})),
  k(n) { return n + '_' + state.classId; },
  load() { this.slips = store.get(this.k('rs_slips'), []); this.counts = store.get(this.k('rs_counts'), {}); },
  save() { store.set(this.k('rs_slips'), this.slips); store.set(this.k('rs_counts'), this.counts); store.set('rs_cfg', this.cfg); },
  tpl() { return document.querySelector('input[name="rs-tpl"]:checked').value; },
  gradeCls() { const m = String(currentClass().name).match(/^(\d)(\d{1,2})$/); return m ? [m[1], String(+m[2])] : ['', '']; },

  /* ----- 名單解析：座號、範圍、姓名（逗號／換行／空白分隔）----- */
  parse(text) {
    const out = [];
    text.split(/[\n\s,，、;；]+/).map(t => t.trim()).filter(Boolean).forEach(t => {
      const rg = t.match(/^(\d+)\s*[-~－～到至]\s*(\d+)$/);
      if (rg) { for (let i = Math.min(+rg[1], +rg[2]); i <= Math.max(+rg[1], +rg[2]); i++) out.push(this.byNo(i)); }
      else if (/^\d+$/.test(t)) out.push(this.byNo(+t));
      else { const i = state.students.indexOf(t); out.push(i >= 0 ? { no: i + 1, name: t } : { no: '', name: t, missing: true }); }
    });
    return out;
  },
  byNo(n) { const nm = state.students[n - 1]; return nm ? { no: n, name: nm } : { no: n, name: `座號${n}`, missing: true }; },

  /* ----- 產生 ----- */
  generate() {
    const tpl = this.tpl(), people = this.parse($('rs-text').value);
    if (!people.length) { toast('⚠️ 請先輸入座號或姓名，或匯入檔案'); return; }
    const good = people.filter(p => !p.missing), bad = people.filter(p => p.missing);
    if (!good.length) { toast(`⚠️ 找不到學生（${bad.map(b => b.name).join('、')}），請先在「雲端與名單設定」匯入 ${currentClass().name} 名單`); return; }
    const date = $('rs-date').value || todayISO(), base = { tpl, date };
    this.cfg.subject = $('rs-subject').value.trim() || '國文'; this.cfg.teacher = $('rs-teacher').value.trim(); this.cfg.phrase = $('rs-phrase').value.trim() || '未確實訂正或完成'; this.cfg.tpl = tpl;
    if (tpl === 'life') {
      const checks = [...document.querySelectorAll('#rs-life-items input[type=checkbox]:checked')].map(c => +c.dataset.i);
      if (!checks.length) { toast('⚠️ 請至少勾選一個「發生狀況」'); return; }
      const texts = {}; document.querySelectorAll('#rs-life-items input[data-key]').forEach(i => texts[i.dataset.key] = i.value.trim());
      Object.assign(base, { checks, texts, subject: this.cfg.subject });
    } else {
      const items = [...document.querySelectorAll('#rs-hw-items input[type=checkbox]:checked')].map(c => c.value), other = $('rs-hw-other').value.trim(); if (other) items.push(other);
      if (!items.length) { toast('⚠️ 請至少勾選一個作業項目'); return; }
      Object.assign(base, { grade: $('rs-grade').value.trim(), cls: $('rs-cls').value.trim(), items: items.join('　'), phrase: this.cfg.phrase, due: $('rs-due').value || '', teacher: this.cfg.teacher });
    }
    good.forEach(p => {
      const s = { id: uid(), no: p.no, name: p.name, ...base };
      if (tpl === 'life') { const key = String(p.no); this.counts[key] = (this.counts[key] || 0) + 1; s.n = this.counts[key]; }
      this.slips.push(s);
    });
    this.save(); this.render();
    toast(`🟥 已產生 ${good.length} 張${tpl === 'life' ? '導師紅單' : '任課老師紅單'}` + (bad.length ? `；找不到：${bad.map(b => b.name).join('、')}` : ''));
  },

  /* ----- 文字片段（畫面／列印／Word 共用）----- */
  lifeSegs(it, s) {
    const x = (s.texts && s.texts[it.key]) || ''; const parts = it.t.split('{x}'); if (parts.length === 1) return [{ t: it.t }];
    return [{ t: parts[0] }, { t: x || BLANK_U, u: true }, { t: parts[1] }];
  },
  lifeLines(s) {
    const d = fromISO(s.date), n = s.n || 0, k = n % 5;
    return {
      title: '校園生活、學習狀況通知單', sub: '【通知家長聯】',
      who: [{ t: s.no ? `${s.no} 號 ` : '' }, { t: s.name, u: true }, { t: '同學於 ' }, { t: String(d.getMonth() + 1), u: true }, { t: ' 月 ' }, { t: String(d.getDate()), u: true }, { t: ' 日星期 ' }, { t: WD[d.getDay()], u: true }, { t: '，' }, { t: s.subject || BLANK_U, u: true }, { t: ' 課，' }],
      lead: '發生下列狀況：',
      items: LIFE_ITEMS.map((it, i) => ({ on: (s.checks || []).includes(i), segs: this.lifeSegs(it, s) })),
      note: [{ t: '※ 孩子的成長需要我們一起努力，請家長關心及協助督促孩子改進，謝謝。 ' }, { t: '（五張紅單一支警告）', b: true }],
      sign: [`＊任課老師簽名：${SIGN}`, `＊班級導師簽名：${SIGN}`, `＊家長簽名：${SIGN}`],
      foot: n ? (k === 0 ? `《第 ${n} 張，已滿五張記警告乙支》` : `《第 ${n} 張，再 ${5 - k} 張記警告乙支》`) : `《第 ＿＿ 張，再 ＿＿ 張記警告乙支》`
    };
  },
  hwLines(s) {
    return {
      title: '國文作業通知單(國文老師)', hello: '敬愛的家長您好：',
      who: [{ t: `${s.grade || BLANK_U}年${s.cls || BLANK_U}班 座號：${s.no || BLANK_U}` }, { t: s.name ? `（${s.name}）` : '' }, { t: '的學生，' }, { t: s.items, b: true }, { t: s.phrase, b: true }, { t: '，特此通知。' }],
      ask: `　請家長協助叮嚀孩子於 ${s.due ? mdw(s.due) : BLANK_U} 補交，未交將扣平時成績，且該項作業 0 分計算。此次記缺點一次。`,
      teacher: `國文老師 ${s.teacher || ''}`, date: `日期：${minguo(s.date)}`,
      star: '★煩請家長協助督促孩子，確實完成作業，以奠定良好的學習基礎。也請鼓勵孩子若有任何學習上的疑問，能主動向老師或同學請教。感謝您的配合與支持！',
      sign: [`班級導師：${'＿'.repeat(10)}`, `家長簽名：${'＿'.repeat(10)}`]
    };
  },
  seg2html: segs => segs.map(g => { let h = esc(g.t); if (g.u) h = `<u>${h}</u>`; if (g.b) h = `<b>${h}</b>`; return h; }).join(''),
  slipHTML(s) {
    if (s.tpl === 'hw') { const L = this.hwLines(s);
      return `<div class="rs-slip hw"><div class="rs-t">${esc(L.title)}</div><div>${esc(L.hello)}</div><div>${this.seg2html(L.who)}</div><div>${esc(L.ask)}</div>
        <div class="rs-r"><span>${esc(L.teacher)}</span></div><div class="rs-r">${esc(L.date)}</div><div class="rs-star">${esc(L.star)}</div>
        <div class="rs-r">${L.sign.map(esc).join('<br>')}</div></div>`; }
    const L = this.lifeLines(s);
    return `<div class="rs-slip life"><div class="rs-t">${esc(L.title)}</div><div class="rs-b">${esc(L.sub)}</div><div>${this.seg2html(L.who)}</div><div class="rs-b">${esc(L.lead)}</div>
      ${L.items.map(i => `<div class="rs-it"><span class="bx ${i.on ? 'on' : ''}">${i.on ? '☑' : '□'}</span> ${this.seg2html(i.segs)}</div>`).join('')}
      <div class="rs-note">${this.seg2html(L.note)}</div>${L.sign.map(x => `<div>${esc(x)}</div>`).join('')}<div class="rs-foot">${esc(L.foot)}</div></div>`;
  },
  pagesHTML(list) {
    const pack = (arr, n, cls) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.map(p => `<div class="print-card rs-page ${cls}"><div class="rs-grid">${p.map(s => this.slipHTML(s)).join('')}</div></div>`).join(''); };
    return pack(list.filter(s => s.tpl !== 'hw'), 4, 'life4') + pack(list.filter(s => s.tpl === 'hw'), 6, 'hw6');
  },

  /* ----- Word ----- */
  dxSegs(segs, size) { const d = window.docx; return segs.map(g => new d.TextRun({ text: g.t, bold: !!g.b, underline: g.u ? {} : undefined, size, font: DX_FONT })); },
  dxSlip(s) {
    const d = window.docx, SZ = 18, P = (kids, o = {}) => new d.Paragraph({ alignment: o.align || d.AlignmentType.LEFT, spacing: { before: 0, after: o.after == null ? 24 : o.after, line: o.line || 268, lineRule: d.LineRuleType.EXACT }, indent: o.indent ? { left: o.indent } : undefined, children: kids });
    const T = (text, o = {}) => new d.TextRun({ text, size: o.size || SZ, bold: !!o.b, font: DX_FONT });
    if (s.tpl === 'hw') { const L = this.hwLines(s), R = d.AlignmentType.RIGHT;
      return [P([T(L.title, { b: true, size: 24 })], { align: d.AlignmentType.CENTER, after: 80, line: 290 }), P([T(L.hello, { size: 19 })], { line: 290 }), P(this.dxSegs(L.who, 19), { line: 290 }), P([T(L.ask, { size: 19 })], { line: 290 }),
        P([T(L.teacher, { size: 19 })], { line: 290 }), P([T(L.date, { size: 19 })], { align: R, line: 290 }), P([T(L.star, { size: 19 })], { line: 290, after: 60 }), ...L.sign.map(x => P([T(x, { size: 19 })], { align: R, line: 320 }))]; }
    const L = this.lifeLines(s);
    return [P([T(L.title, { b: true, size: 22 })], { align: d.AlignmentType.CENTER, after: 40, line: 300 }), P([T(L.sub, { b: true })]), P(this.dxSegs(L.who, SZ)), P([T(L.lead, { b: true })]),
      ...L.items.map(i => P([T(i.on ? '☑ ' : '□ '), ...this.dxSegs(i.segs, SZ)])), P(this.dxSegs(L.note, SZ), { after: 40 }), ...L.sign.map(x => P([T(x)])), P([T(L.foot, { b: true })], { align: d.AlignmentType.CENTER, after: 0 })];
  },
  async word(list, name) {
    if (!needDocx()) return; const d = window.docx, rows = [], W = 5386, hw = list.length && list[0].tpl === 'hw', H = hw ? 5150 : 7700;
    for (let i = 0; i < list.length; i += 2) {
      const cell = s => new d.TableCell({ width: { size: W, type: d.WidthType.DXA }, margins: { top: 100, bottom: 60, left: 140, right: 140 }, children: s ? this.dxSlip(s) : [new d.Paragraph({ children: [] })] });
      rows.push(new d.TableRow({ cantSplit: true, height: { value: H, rule: d.HeightRule.EXACT }, children: [cell(list[i]), cell(list[i + 1])] }));
    }
    const doc = new d.Document({ styles: { default: { document: { run: { font: DX_FONT, size: 17 } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } },
      children: [new d.Table({ width: { size: W * 2, type: d.WidthType.DXA }, columnWidths: [W, W], layout: d.TableLayoutType.FIXED, rows }), new d.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACT }, children: [] })] }] });
    downloadBlob(await d.Packer.toBlob(doc), name); toast('📄 Word 已產生，請查看下載資料夾');
  },

  /* ----- 畫面 ----- */
  render() {
    $('rs-count').textContent = this.slips.length ? `（共 ${this.slips.length} 張）` : '';
    $('rs-preview').innerHTML = this.slips.length
      ? `<div class="rs-grid rs-grid-prev">${this.slips.map((s, i) => `<div class="rs-wrap">${this.slipHTML(s)}<button class="btn btn-danger btn-sm rs-x" data-i="${i}" title="刪除這張">✕</button></div>`).join('')}</div>`
      : '<div class="empty-preview">尚未產生紅單</div>';
    const ks = Object.keys(this.counts).filter(k => this.counts[k] > 0).sort((a, b) => +a - +b);
    $('rs-ledger').innerHTML = ks.length ? ks.map(k => `<span class="rs-chip" data-k="${k}"><b>${esc(who(+k))}</b> ${this.counts[k]} 張<button data-op="sub">−</button><button data-op="add">＋</button><button data-op="zero">歸零</button></span>`).join('') : '<span class="help-text">尚無累計（開立「導師紅單」後會自動累計；五張一支警告）</span>';
  },
  applyTpl() {
    const t = this.tpl(); $('rs-life-box').style.display = t === 'life' ? 'block' : 'none'; $('rs-hw-box').style.display = t === 'hw' ? 'block' : 'none'; $('rs-subject-wrap').style.display = t === 'life' ? 'block' : 'none';
  },
  init() {
    this.load();
    $('rs-life-items').innerHTML = LIFE_ITEMS.map((it, i) => { const p = it.t.split('{x}');
      return `<label class="rs-ck"><input type="checkbox" data-i="${i}"><span>${esc(p[0])}${p[1] !== undefined ? `<input type="text" data-key="${it.key}" placeholder="${esc(it.ph)}" class="rs-inl">${esc(p[1])}` : ''}</span></label>`; }).join('');
    $('rs-hw-items').innerHTML = HW_ITEMS.map((x, i) => `<label class="rs-ck inline"><input type="checkbox" value="${x}" ${i < 2 ? 'checked' : ''}> ${x}</label>`).join('');
    $('rs-date').value = todayISO(); $('rs-subject').value = this.cfg.subject; $('rs-teacher').value = this.cfg.teacher; $('rs-phrase').value = this.cfg.phrase;
    const [g, c] = this.gradeCls(); $('rs-grade').value = g; $('rs-cls').value = c;
    document.querySelector(`input[name="rs-tpl"][value="${this.cfg.tpl}"]`).checked = true; this.applyTpl();
    document.querySelectorAll('input[name="rs-tpl"]').forEach(r => r.addEventListener('change', () => this.applyTpl()));
    $('rs-gen').addEventListener('click', () => { Sound.play('click'); this.generate(); });
    $('rs-file').addEventListener('change', async e => {
      try {
        const rows = await readRows(e.target.files[0]); if (!rows.length) return;
        const skip = /^(座號|號碼|姓名|學生|name|no)/i.test(rows[0][0] || '') ? 1 : 0; $('rs-text').value = rows.slice(skip).map(r => r[0]).join('\n'); toast(`📥 已匯入 ${rows.length - skip} 筆，請按「產生紅單」`);
      } catch (err) { toast('❌ 檔案讀取失敗'); } e.target.value = '';
    });
    $('rs-all').addEventListener('click', () => { if (!state.students.length) { toast('⚠️ 這個班級還沒有名單'); return; } $('rs-text').value = `1-${state.students.length}`; toast('👥 已帶入全班座號'); });
    $('rs-clear').addEventListener('click', () => { if (!this.slips.length || !confirm('確定清空所有紅單？（累計張數不會變）')) return; this.slips = []; this.save(); this.render(); });
    $('rs-print').addEventListener('click', () => { Sound.play('click'); if (!this.slips.length) { toast('⚠️ 尚無紅單可列印'); return; } printHTML(this.pagesHTML(this.slips)); });
    $('rs-word').addEventListener('click', () => {
      if (!this.slips.length) { toast('⚠️ 尚無紅單可下載'); return; }
      const tp = this.tpl(), list = this.slips.filter(s => s.tpl === tp); if (!list.length) { toast('⚠️ 目前沒有這個版本的紅單，請先產生'); return; }
      this.word(list, `${currentClass().name}_${tp === 'life' ? '導師紅單_校園生活學習狀況通知單' : '任課老師紅單_國文作業通知單'}.docx`);
    });
    $('rs-preview').addEventListener('click', e => {
      const b = e.target.closest('.rs-x'); if (!b) return; const s = this.slips.splice(+b.dataset.i, 1)[0];
      if (s && s.tpl === 'life') { const k = String(s.no); this.counts[k] = Math.max(0, (this.counts[k] || 1) - 1); } this.save(); this.render();
    });
    $('rs-ledger').addEventListener('click', e => {
      const b = e.target.closest('[data-op]'); if (!b) return; const k = b.closest('.rs-chip').dataset.k, op = b.dataset.op;
      this.counts[k] = op === 'zero' ? 0 : Math.max(0, (this.counts[k] || 0) + (op === 'add' ? 1 : -1)); this.save(); this.render();
    });
    this.render();
  },
  reload() { this.load(); const [g, c] = this.gradeCls(); $('rs-grade').value = g; $('rs-cls').value = c; this.render(); }
};

window.addEventListener('DOMContentLoaded', () => { CL.init(); RS.init(); });
document.addEventListener('classchange', () => { CL.load(); CL.renderAll(); RS.reload(); });
