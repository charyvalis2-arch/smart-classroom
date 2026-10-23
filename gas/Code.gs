/**
 * 智慧課堂 — Google Apps Script 後端（選用）
 *
 * 部署方式：
 *  1. 開啟 https://script.google.com → 新增專案 → 貼上本檔全部內容
 *  2. 右上「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *       執行身分：我　　誰可以存取：所有人
 *  3. 複製「網頁應用程式網址」(結尾是 /exec)，貼到網站「雲端與名單設定」
 *  4. 第一次執行會要求授權；授權後，會自動在你的雲端硬碟建立「智慧課堂資料庫」試算表
 *
 * 提供的 action：
 *   GET : init, getStudents, getScores, getReportCards
 *   POST: updateStudents, saveScores, logDraw, saveReportCards
 */
const SHEET = { students: '學生名單', teams: '小組積分', draws: '抽籤紀錄', reports: '段考成績' };

function getSS_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SSID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* 被刪除時重建 */ } }
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create('智慧課堂資料庫');
  props.setProperty('SSID', ss.getId());
  return ss;
}
function sheet_(name, header) {
  const ss = getSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#eef1fb'); }
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function rewrite_(sh, header, rows) {
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
}
function readRows_(sh, cols) {
  const last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, cols).getValues();
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'init';
    if (action === 'init') {
      const ss = getSS_();
      sheet_(SHEET.students, ['姓名']); sheet_(SHEET.teams, ['組名', '分數', '顏色']);
      sheet_(SHEET.draws, ['時間', '姓名']); sheet_(SHEET.reports, ['姓名', '國語', '數學', '英語', '自然', '社會', '學習態度', '導師評語']);
      return out_({ success: true, spreadsheetUrl: ss.getUrl() });
    }
    if (action === 'getStudents') {
      const rows = readRows_(sheet_(SHEET.students, ['姓名']), 1);
      return out_({ success: true, students: rows.map(r => String(r[0]).trim()).filter(Boolean) });
    }
    if (action === 'getScores') {
      const rows = readRows_(sheet_(SHEET.teams, ['組名', '分數', '顏色']), 3);
      return out_({ success: true, teams: rows.map(r => ({ name: String(r[0]), score: Number(r[1]) || 0, color: String(r[2] || '#4DABF7') })) });
    }
    if (action === 'getReportCards') {
      const rows = readRows_(sheet_(SHEET.reports, ['姓名', '國語', '數學', '英語', '自然', '社會', '學習態度', '導師評語']), 8);
      return out_({ success: true, reports: rows.map(r => ({ name: String(r[0]), chinese: +r[1] || 0, math: +r[2] || 0, english: +r[3] || 0, science: +r[4] || 0, social: +r[5] || 0, attitude: String(r[6] || '優'), comment: String(r[7] || '') })) });
    }
    return out_({ success: false, error: '未知的 action：' + action });
  } catch (err) { return out_({ success: false, error: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(e.postData.contents), action = body.action;
    if (action === 'updateStudents') {
      rewrite_(sheet_(SHEET.students, ['姓名']), ['姓名'], (body.students || []).map(n => [String(n)]));
      return out_({ success: true });
    }
    if (action === 'saveScores') {
      rewrite_(sheet_(SHEET.teams, ['組名', '分數', '顏色']), ['組名', '分數', '顏色'], (body.teams || []).map(t => [String(t.name), Number(t.score) || 0, String(t.color || '')]));
      return out_({ success: true });
    }
    if (action === 'logDraw') {
      sheet_(SHEET.draws, ['時間', '姓名']).appendRow([new Date(), String(body.studentName || '')]);
      return out_({ success: true });
    }
    if (action === 'saveReportCards') {
      const H = ['姓名', '國語', '數學', '英語', '自然', '社會', '學習態度', '導師評語'];
      rewrite_(sheet_(SHEET.reports, H), H, (body.reports || []).map(r => [String(r.name), r.chinese || 0, r.math || 0, r.english || 0, r.science || 0, r.social || 0, String(r.attitude || '優'), String(r.comment || '')]));
      return out_({ success: true });
    }
    return out_({ success: false, error: '未知的 action：' + action });
  } catch (err) { return out_({ success: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (e2) {} }
}
