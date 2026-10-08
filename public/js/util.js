import { icon } from './icons.js';
import { getLang, locale, t } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* ---------- dates (all YYYY-MM-DD strings in Thai local time) ---------- */

const utc = (d) => new Date(d + 'T00:00:00Z');
export const todayStr = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const fmtDate = (d) => utc(d).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateShort = (d) => utc(d).toLocaleDateString(locale(), { timeZone: 'UTC', day: 'numeric', month: 'short' });
export const fmtDay = (d) => utc(d).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'short' });
export const fmtMonth = (ym) => utc(ym + '-01').toLocaleDateString(locale(), { timeZone: 'UTC', month: 'long', year: 'numeric' });
export const dayNum = (d) => Number(d.slice(8));
export const dow = (d) => utc(d).getUTCDay();
export const isWeekend = (d) => [0, 6].includes(dow(d));
// short weekday name, 0 = Sunday (2023-01-01 was a Sunday)
export const dowShort = (i) => new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'short' });

export function addDays(d, n) {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function addMonths(ym, n) {
  const x = utc(ym + '-01');
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 7);
}
export const monthRange = (ym) => ({ from: ym + '-01', to: addDays(addMonths(ym, 1) + '-01', -1) });
// Monday of the week containing `d`
export const weekStart = (d) => addDays(d, -((dow(d) + 6) % 7));

export const fmtHours = (h) => {
  if (h == null) return '–';
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
export const fmtDays = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* ---------- vocab ---------- */

export const STATUS = {
  present: { get label() { return t('มาทำงาน'); }, cls: 'ok', icon: 'check' },
  late: { get label() { return t('สาย'); }, cls: 'warn', icon: 'clock' },
  leave: { get label() { return t('ลา'); }, cls: 'info', icon: 'tree-palm' },
  absent: { get label() { return t('ขาด'); }, cls: 'bad', icon: 'x' },
  pending: { get label() { return t('ยังไม่เข้า'); }, cls: 'mute', icon: 'hourglass' },
};
export const LEAVE_TYPES = {
  sick: { get label() { return t('ลาป่วย'); }, icon: 'thermometer', tone: 'red' },
  personal: { get label() { return t('ลากิจ'); }, icon: 'briefcase', tone: 'lav' },
  vacation: { get label() { return t('ลาพักร้อน'); }, icon: 'tree-palm', tone: 'sky' },
  other: { get label() { return t('อื่น ๆ'); }, icon: 'sparkles', tone: 'pink' },
};
export const LEAVE_STATUS = {
  pending: { get label() { return t('รออนุมัติ'); }, cls: 'mute', icon: 'hourglass' },
  approved: { get label() { return t('อนุมัติแล้ว'); }, cls: 'ok', icon: 'circle-check' },
  rejected: { get label() { return t('ไม่อนุมัติ'); }, cls: 'bad', icon: 'circle-x' },
  cancelled: { get label() { return t('ยกเลิกแล้ว'); }, cls: 'mute', icon: 'x' },
};
export const PART_LABEL = { full: '', get am() { return ' ' + t('(ครึ่งวันเช้า)'); }, get pm() { return ' ' + t('(ครึ่งวันบ่าย)'); } };

/* ---------- small UI pieces ---------- */

export const badge = (text, cls = 'mute', ic = null) => `<span class="badge ${cls}">${ic ? icon(ic, 13) : ''}${esc(text)}</span>`;

export const statusBadge = (row) => {
  const st = STATUS[row.status];
  let text = st.label;
  let ic = st.icon;
  if (row.status === 'late') text = t('สาย {n} น.', { n: row.late_minutes });
  if (row.leave_type) {
    ic = LEAVE_TYPES[row.leave_type].icon;
    text = row.status === 'leave' ? `${LEAVE_TYPES[row.leave_type].label}${PART_LABEL[row.leave_part] ?? ''}` : t('{status} · ลาครึ่งวัน', { status: text });
  }
  return badge(text, st.cls, ic);
};

// language switch pill (clicks are handled in main.js)
export const langButton = (cls = '') => `<button class="lang-btn ${cls}" id="lang-toggle" type="button" aria-label="${t('เปลี่ยนภาษา')}">${icon('languages', 16)}<span>${getLang() === 'th' ? 'EN' : 'ไทย'}</span></button>`;

export const displayName = (u) => u.nickname || u.full_name.split(' ')[0];

// tinted square holding an icon; tone: pink | lav | mint | sky | lemon | red
export const iconChip = (name, tone = 'pink', size = 20) => `<span class="icon-chip ${tone}">${icon(name, size)}</span>`;

const AVATARS = [['#ff9ac4', '#ff6fae'], ['#b6a8ff', '#8b7cf6'], ['#7be0bb', '#27b583'], ['#8cc9ff', '#3a95e8'], ['#ffd17a', '#f2a024'], ['#ffa59a', '#ef6a5b'], ['#a3e3ee', '#34b6cc'], ['#e7a6f5', '#c05fe0']];
export function avatar(person, size = 38) {
  const name = typeof person === 'string' ? person : (person.nickname || person.full_name || '?');
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const [a, b] = AVATARS[h % AVATARS.length];
  return `<span class="avatar" style="--a:${a};--b:${b};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc([...name][0] ?? '?')}</span>`;
}

export const skeleton = (rows = 3) => Array.from({ length: rows }, () => '<div class="card skel"><i></i><i></i><i></i></div>').join('');

export const cardTitle = (ic, tone, title, right = '') =>
  `<div class="card-title"><div class="row" style="gap:10px;flex-wrap:nowrap">${iconChip(ic, tone, 18)}<h2>${title}</h2></div>${right}</div>`;

/* ---------- toast, modal, confetti ---------- */

export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'ok' ? 'circle-check' : 'circle-alert', 18)}<span>${esc(msg)}</span>`;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ff6fae', '#ffb48a', '#8b7cf6', '#27b583', '#3a95e8', '#ffd95e'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('i');
    s.style.cssText = `--x:${(Math.random() * 2 - 1) * 150}px;--y:${-(140 + Math.random() * 200)}px;--r:${Math.random() * 720 - 360}deg;--d:${1000 + Math.random() * 700}ms;background:${colors[i % colors.length]}`;
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2000);
}

export const buzz = (ms = 40) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

// Opens a bottom-sheet/dialog. `html` is the inner markup; returns { el, close }.
export function openModal(html, { onClose } = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  root.append(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  wrap.querySelector('input:not([type=hidden]),select,textarea')?.focus();
  return { el: wrap.firstElementChild, close };
}

export const confirmBox = (message, okLabel = t('ตกลง')) => new Promise((resolve) => {
  let answered = false;
  const m = openModal(`<p class="confirm-msg">${esc(message)}</p>
    <div class="row end"><button class="btn" data-close>${t('ยกเลิก')}</button><button class="btn primary" data-ok>${esc(okLabel)}</button></div>`,
  { onClose: () => !answered && resolve(false) });
  m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
});

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

// Disables the button while `fn` runs and surfaces errors as a toast.
export async function busy(btn, fn) {
  btn?.setAttribute('disabled', '');
  try { return await fn(); } catch (e) { toast(e.message || t('เกิดข้อผิดพลาด'), 'bad'); } finally { btn?.removeAttribute('disabled'); }
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(t('โหลดสคริปต์ไม่สำเร็จ')));
    document.head.append(s);
  });
}

// Sizes the QR <svg> inside `slot` to a whole number of *device* pixels per module (otherwise modules come out uneven
// and the code looks wobbly on phones). Returns a function that stops watching.
export function fitQr(slot) {
  const svg = slot?.querySelector('svg[data-modules]');
  if (!svg) return () => {};
  const n = Number(svg.dataset.modules);
  const apply = () => {
    const dpr = window.devicePixelRatio || 1;
    const cell = Math.max(1, Math.floor((slot.clientWidth * dpr) / n));
    const px = `${(cell * n) / dpr}px`;
    svg.style.width = px;
    svg.style.height = px;
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(slot);
  return () => ro.disconnect();
}
