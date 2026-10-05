import { api } from '../api.js';
import { mascot } from '../mascot.js';
import { openScanner } from '../scanner.js';
import { LEAVE_TYPES, PART_LABEL, badge, displayName, esc, fmtDate, fmtHours, openModal, toast } from '../util.js';

const QR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
  <path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4h-3"/></svg>`;

const TZ = 'Asia/Bangkok';
const clockFmt = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const hourOf = (ms) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(ms)) % 24;

export default function home(el, { user, navigate }) {
  let st = null;
  let skew = 0; // server time minus device time, so a wrong phone clock doesn't confuse people
  let timer = null;
  const now = () => Date.now() + skew;

  const greeting = () => { const h = hourOf(now()); return h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; };

  async function load() {
    st = await api.get('/today');
    skew = Date.parse(st.server_time) - Date.now();
    draw();
  }

  function worked() {
    const r = st.record;
    if (!r?.check_in_at) return null;
    const end = r.check_out_at ? Date.parse(r.check_out_at) : now();
    return Math.max(0, (end - Date.parse(r.check_in_at)) / 3600000);
  }

  function draw() {
    const r = st.record;
    const action = st.next_action;
    const face = action === 'in' ? 'sleepy' : action === 'out' ? 'happy' : 'bye';
    const btn = action === 'in' ? { cls: 'in', text: 'สแกนเข้างาน' } : action === 'out' ? { cls: 'out', text: 'สแกนออกงาน' } : { cls: 'done', text: 'วันนี้เรียบร้อย ✨' };
    const s = st.settings;
    el.innerHTML = `
      <section class="card hero">
        <div class="hello">${greeting()} <b>${esc(displayName(user))}</b> 👋</div>
        <div class="clock" id="clock">--:--:--</div>
        <div class="muted">${fmtDate(st.date)}</div>
        ${mascot(face, 120)}
        <div class="scan-wrap">
          <button class="scan-btn ${btn.cls}" id="scan" ${action === 'done' ? 'disabled' : ''}>${action === 'done' ? '<span style="font-size:2.4rem">🎉</span>' : QR_ICON}<span>${btn.text}</span></button>
        </div>
        <p class="muted small" style="margin-top:14px">เวลางาน ${esc(s.work_start)} – ${esc(s.work_end)} น. · สแกน QR ที่ติดไว้ที่ทำงานเท่านั้นนะ</p>
      </section>

      ${st.leave ? `<div class="banner info">🌴 วันนี้คุณลา${esc(LEAVE_TYPES[st.leave.type].label)}${PART_LABEL[st.leave.part]} — ถ้ามาทำงานก็สแกนได้ตามปกติ</div>` : ''}

      <section class="card">
        <div class="card-title"><h3>วันนี้ของฉัน</h3>${r?.check_in ? (r.late_minutes > 0 ? badge(`สาย ${r.late_minutes} นาที`, 'warn') : badge('ตรงเวลา ✨', 'ok')) : badge('ยังไม่ได้เข้างาน', 'mute')}</div>
        <div class="times">
          <div class="time-tile"><small>เข้างาน</small><b>${r?.check_in ?? '–'}</b></div>
          <div class="time-tile"><small>ออกงาน</small><b>${r?.check_out ?? '–'}</b></div>
          <div class="time-tile"><small>ทำงานแล้ว</small><b id="worked">${fmtHours(worked())}</b></div>
        </div>
      </section>

      ${st.pending_leaves ? `<a class="banner warn" href="#/leave" style="text-decoration:none;color:inherit">⏳ มีใบลารออนุมัติ ${st.pending_leaves} ใบ</a>` : ''}`;
    el.querySelector('#scan')?.addEventListener('click', startScan);
    tick();
  }

  function tick() {
    const c = el.querySelector('#clock');
    if (!c) return;
    c.textContent = clockFmt.format(now());
    const w = el.querySelector('#worked');
    if (w && st.record?.check_in_at && !st.record.check_out_at) w.textContent = fmtHours(worked());
  }

  async function startScan() {
    const action = st.next_action;
    let result = null;
    const ok = await openScanner(action === 'in' ? 'สแกนเข้างาน' : 'สแกนออกงาน', async (text) => {
      if (!text.startsWith('KN1:')) return { done: false, message: 'นี่ไม่ใช่ QR ของที่ทำงานนะ ลองสแกนใหม่ 🙈' };
      try {
        result = await api.post('/checkin', { action, code: text });
        return { done: true };
      } catch (e) {
        if (e.status === 400) return { done: false, message: e.message };
        toast(e.message, 'bad'); // already checked in / too soon etc: close the camera and refresh
        return { done: true };
      }
    });
    if (ok && result) { st = result.state; draw(); celebrate(result); } else if (ok) { load(); }
  }

  function celebrate({ action, state }) {
    const r = state.record;
    const isIn = action === 'in';
    const late = isIn && r.late_minutes > 0;
    const m = openModal(`
      <div class="result-modal">
        ${mascot(late ? 'oops' : isIn ? 'happy' : 'bye', 110)}
        <h2>${isIn ? (late ? 'เข้างานแล้ว (สายนิดนึง)' : 'เข้างานเรียบร้อย!') : 'ออกงานเรียบร้อย!'}</h2>
        <div class="big">${isIn ? r.check_in : r.check_out}</div>
        <p class="muted">${isIn ? (late ? `สายไป ${r.late_minutes} นาที พรุ่งนี้สู้ ๆ นะ 💪` : 'ตรงเวลาเป๊ะ วันนี้ก็สู้ ๆ นะ 💖') : `วันนี้ทำงาน ${fmtHours(worked())} ชม. เหนื่อยแล้ว กลับบ้านดี ๆ นะ 🌙`}</p>
        <button class="btn primary" data-close>ตกลง</button>
      </div>`);
    setTimeout(() => m.close(), 6000);
  }

  load().catch((e) => { el.innerHTML = `<div class="card empty">${esc(e.message)}<br><button class="btn" id="retry">ลองใหม่</button></div>`; el.querySelector('#retry').onclick = () => load(); });
  timer = setInterval(tick, 1000);
  const onVisible = () => { if (!document.hidden) load().catch(() => {}); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
