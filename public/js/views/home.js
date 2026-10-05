import { api } from '../api.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import { openScanner } from '../scanner.js';
import {
  DOW_SHORT, LEAVE_TYPES, PART_LABEL, STATUS, addDays, badge, buzz, cardTitle, confetti, displayName, esc, fmtDate, fmtHours, iconChip, openModal, toast, todayStr, weekStart,
} from '../util.js';

const TZ = 'Asia/Bangkok';
const clockFmt = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const hourOf = (ms) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(ms)) % 24;
const RING_LEN = 2 * Math.PI * 96;

const toHours = (hhmm) => Number(hhmm.slice(0, 2)) + Number(hhmm.slice(3, 5)) / 60;

export default function home(el, { user }) {
  let st = null;
  let week = [];
  let skew = 0; // server time minus device time, so a wrong phone clock doesn't confuse people
  let timer = null;
  const now = () => Date.now() + skew;

  const greeting = () => { const h = hourOf(now()); return h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; };

  async function load() {
    const monday = weekStart(todayStr());
    [st, week] = await Promise.all([api.get('/today'), api.get(`/attendance?from=${monday}&to=${addDays(monday, 6)}`).then((d) => d.rows).catch(() => [])]);
    skew = Date.parse(st.server_time) - Date.now();
    draw();
  }

  const worked = () => {
    const r = st.record;
    if (!r?.check_in_at) return null;
    const end = r.check_out_at ? Date.parse(r.check_out_at) : now();
    return Math.max(0, (end - Date.parse(r.check_in_at)) / 3600000);
  };
  const shiftHours = () => Math.max(1, toHours(st.settings.work_end) - toHours(st.settings.work_start));

  function bubbleText(action) {
    const h = hourOf(now());
    const afterWork = h * 60 >= toHours(st.settings.work_end) * 60;
    if (st.leave && action === 'in') return 'วันนี้ลาอยู่นะ พักผ่อนให้เต็มที่เลย~';
    if (action === 'in') return h < 12 ? 'อรุณสวัสดิ์~ อย่าลืมสแกนเข้างานนะ' : 'ยังไม่ได้สแกนเข้างานเลยน้า';
    if (action === 'out') return afterWork ? 'เลิกงานแล้ว! อย่าลืมสแกนออกนะ' : 'กำลังทำงานอยู่ สู้ ๆ นะ!';
    return 'เหนื่อยแล้วนะ กลับบ้านดี ๆ ~';
  }

  function weekStrip() {
    const monday = weekStart(todayStr());
    const byDate = new Map(week.map((r) => [r.date, r]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const r = byDate.get(date);
      const today = date === st.date;
      const s = r ? STATUS[r.status] : null;
      const waiting = today && (!r || r.status === 'pending');
      const cls = r && r.status !== 'pending' ? s.cls : '';
      const ic = r && r.status !== 'pending' ? icon(s.icon, 18) : '';
      return `<div class="wday ${today ? 'today' : ''} ${waiting ? 'waiting' : ''}"><span>${DOW_SHORT[(i + 1) % 7]}</span><span class="wdot ${cls}">${ic}</span></div>`;
    }).join('');
  }

  function draw() {
    const r = st.record;
    const action = st.next_action;
    const face = st.leave && action === 'in' ? 'chill' : action === 'in' ? 'sleepy' : action === 'out' ? 'happy' : 'bye';
    const btn = action === 'in'
      ? { cls: 'in', text: 'สแกนเข้างาน', ic: icon('qr-code', 58) }
      : action === 'out' ? { cls: 'out', text: 'สแกนออกงาน', ic: icon('qr-code', 58) } : { cls: 'done', text: 'วันนี้เรียบร้อย', ic: icon('party-popper', 54) };
    const ratio = action === 'done' ? 1 : Math.min(1, (worked() ?? 0) / shiftHours());
    const s = st.settings;
    el.innerHTML = `
      <section class="card hero">
        <div class="hero-band"><div class="mascot-row">${mascot(face, 104)}<div class="bubble">${bubbleText(action)}</div></div></div>
        <div class="hero-body">
        <div class="hello">${greeting()}, <b>${esc(displayName(user))}</b></div>
        <div class="clock" id="clock">--:--:--</div>
        <div class="date-chip">${icon('calendar-days', 15)}${fmtDate(st.date)}</div>
        <div class="ring-wrap ${btn.cls}">
          <svg class="ring" viewBox="0 0 224 224" aria-hidden="true">
            <circle class="track" cx="112" cy="112" r="96"/>
            <circle class="prog" id="prog" cx="112" cy="112" r="96" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/>
          </svg>
          <button class="scan-btn ${btn.cls}" id="scan" ${action === 'done' ? 'disabled' : ''}>${btn.ic}<span>${btn.text}</span></button>
        </div>
        ${action === 'out' ? `<div class="date-chip" id="ring-note">${icon('timer', 15)}ทำงานแล้ว ${fmtHours(worked())} จาก ${fmtHours(shiftHours())} ชม.</div>` : ''}
        <div class="shift-line"><span>${icon('clock', 14)}เวลางาน ${esc(s.work_start)} – ${esc(s.work_end)} น.</span><span>${icon('map-pin', 14)}สแกน QR ที่ทำงานเท่านั้น</span></div>
        </div>
      </section>

      ${st.leave ? `<div class="banner info">${icon('tree-palm', 22)}<span>วันนี้คุณลา${esc(LEAVE_TYPES[st.leave.type].label)}${PART_LABEL[st.leave.part]} — ถ้ามาทำงานก็สแกนได้ตามปกติ</span></div>` : ''}

      <section class="card">
        ${cardTitle('clock', 'pink', 'วันนี้ของฉัน', r?.check_in ? (r.late_minutes > 0 ? badge(`สาย ${r.late_minutes} นาที`, 'warn', 'clock') : badge('ตรงเวลา', 'ok', 'circle-check')) : badge('ยังไม่ได้เข้างาน', 'mute', 'hourglass'))}
        <div class="times">
          <div class="time-tile">${iconChip('log-in', 'mint', 16)}<small>เข้างาน</small><b>${r?.check_in ?? '–'}</b></div>
          <div class="time-tile">${iconChip('log-out', 'lav', 16)}<small>ออกงาน</small><b>${r?.check_out ?? '–'}</b></div>
          <div class="time-tile">${iconChip('timer', 'sky', 16)}<small>ทำงานแล้ว</small><b id="worked">${fmtHours(worked())}</b></div>
        </div>
      </section>

      <section class="card">
        ${cardTitle('calendar-check', 'mint', 'สัปดาห์นี้', '<a class="btn small" href="#/history">ดูประวัติ</a>')}
        <div class="week">${weekStrip()}</div>
      </section>

      ${st.pending_leaves ? `<a class="banner warn" href="#/leave" style="text-decoration:none;color:inherit">${icon('hourglass', 22)}<span>มีใบลารออนุมัติ ${st.pending_leaves} ใบ</span></a>` : ''}`;
    el.querySelector('#scan')?.addEventListener('click', startScan);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const p = el.querySelector('#prog');
      if (p) p.style.strokeDashoffset = String(RING_LEN * (1 - ratio));
    }));
    tick();
  }

  function tick() {
    const c = el.querySelector('#clock');
    if (!c) return;
    c.textContent = clockFmt.format(now());
    if (st.record?.check_in_at && !st.record.check_out_at) {
      const w = el.querySelector('#worked');
      if (w) w.textContent = fmtHours(worked());
      const note = el.querySelector('#ring-note');
      if (note) note.lastChild.textContent = `ทำงานแล้ว ${fmtHours(worked())} จาก ${fmtHours(shiftHours())} ชม.`;
    }
  }

  async function startScan() {
    const action = st.next_action;
    let result = null;
    const ok = await openScanner(action === 'in' ? 'สแกนเข้างาน' : 'สแกนออกงาน', async (text) => {
      if (!text.startsWith('KN1:')) return { done: false, message: 'นี่ไม่ใช่ QR ของที่ทำงานนะ ลองสแกนใหม่' };
      try {
        result = await api.post('/checkin', { action, code: text });
        return { done: true };
      } catch (e) {
        if (e.status === 400) return { done: false, message: e.message };
        toast(e.message, 'bad'); // already checked in / too soon etc: close the camera and refresh
        return { done: true };
      }
    });
    if (ok && result) { st = result.state; await refreshWeek(); draw(); celebrate(result); } else if (ok) { load(); }
  }

  async function refreshWeek() {
    const monday = weekStart(todayStr());
    week = await api.get(`/attendance?from=${monday}&to=${addDays(monday, 6)}`).then((d) => d.rows).catch(() => week);
  }

  function celebrate({ action, state }) {
    const r = state.record;
    const isIn = action === 'in';
    const late = isIn && r.late_minutes > 0;
    buzz([40, 50, 80]);
    if (!late) confetti();
    const m = openModal(`
      <div class="result-modal">
        ${mascot(late ? 'oops' : isIn ? 'happy' : 'bye', 120)}
        <h2>${isIn ? (late ? 'เข้างานแล้ว (สายนิดนึง)' : 'เข้างานเรียบร้อย!') : 'ออกงานเรียบร้อย!'}</h2>
        <div class="big">${isIn ? r.check_in : r.check_out}</div>
        <p class="muted" style="font-weight:600;margin-top:6px">${isIn ? (late ? `สายไป ${r.late_minutes} นาที พรุ่งนี้สู้ ๆ นะ` : 'ตรงเวลาเป๊ะ วันนี้ก็สู้ ๆ นะ') : `วันนี้ทำงาน ${fmtHours(worked())} ชม. เหนื่อยแล้ว กลับบ้านดี ๆ นะ`}</p>
        <button class="btn primary" data-close>${icon('check', 18)}ตกลง</button>
      </div>`);
    setTimeout(() => m.close(), 7000);
  }

  load().catch((e) => { el.innerHTML = `<div class="card empty">${esc(e.message)}<br><button class="btn" id="retry">ลองใหม่</button></div>`; el.querySelector('#retry').onclick = () => load(); });
  timer = setInterval(tick, 1000);
  const onVisible = () => { if (!document.hidden) load().catch(() => {}); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
