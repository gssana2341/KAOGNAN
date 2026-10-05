export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const utc = (d) => new Date(d + 'T00:00:00Z');
export const fmtDate = (d) => utc(d).toLocaleDateString('th-TH', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateShort = (d) => utc(d).toLocaleDateString('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' });
export const fmtDay = (d) => utc(d).toLocaleDateString('th-TH', { timeZone: 'UTC', weekday: 'short' });
export const fmtMonth = (ym) => utc(ym + '-01').toLocaleDateString('th-TH', { timeZone: 'UTC', month: 'long', year: 'numeric' });
export const dayNum = (d) => Number(d.slice(8));
export const isWeekend = (d) => [0, 6].includes(utc(d).getUTCDay());

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
export const monthRange = (ym) => {
  const to = addDays(addMonths(ym, 1) + '-01', -1);
  return { from: ym + '-01', to };
};

export const fmtHours = (h) => {
  if (h == null) return '–';
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
export const fmtDays = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const STATUS = {
  present: { label: 'มาทำงาน', cls: 'ok' },
  late: { label: 'สาย', cls: 'warn' },
  leave: { label: 'ลา', cls: 'info' },
  absent: { label: 'ขาด', cls: 'bad' },
  pending: { label: 'ยังไม่เข้า', cls: 'mute' },
};
export const LEAVE_TYPES = {
  sick: { label: 'ลาป่วย', icon: '🤒' },
  personal: { label: 'ลากิจ', icon: '📝' },
  vacation: { label: 'ลาพักร้อน', icon: '🏖️' },
  other: { label: 'อื่น ๆ', icon: '✨' },
};
export const LEAVE_STATUS = {
  pending: { label: 'รออนุมัติ', cls: 'mute' },
  approved: { label: 'อนุมัติแล้ว', cls: 'ok' },
  rejected: { label: 'ไม่อนุมัติ', cls: 'bad' },
  cancelled: { label: 'ยกเลิก', cls: 'mute' },
};
export const PART_LABEL = { full: '', am: ' (ครึ่งวันเช้า)', pm: ' (ครึ่งวันบ่าย)' };

export const badge = (text, cls = 'mute') => `<span class="badge ${cls}">${esc(text)}</span>`;
export const statusBadge = (row) => {
  const st = STATUS[row.status];
  let text = st.label;
  if (row.status === 'late') text += ` ${row.late_minutes} น.`;
  if (row.leave_type) text = row.status === 'leave' ? `${LEAVE_TYPES[row.leave_type].label}${PART_LABEL[row.leave_part] ?? ''}` : `${text} · ครึ่งวันลา`;
  return badge(text, st.cls);
};
export const displayName = (u) => u.nickname || u.full_name.split(' ')[0];

/* ---------- toast + modal ---------- */

export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

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

export const confirmBox = (message, okLabel = 'ตกลง') => new Promise((resolve) => {
  let answered = false;
  const m = openModal(`<p class="confirm-msg">${esc(message)}</p>
    <div class="row end"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>${esc(okLabel)}</button></div>`,
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

// Disables the submit button while `fn` runs and surfaces errors as a toast.
export async function busy(btn, fn) {
  btn?.setAttribute('disabled', '');
  try { return await fn(); } catch (e) { toast(e.message || 'เกิดข้อผิดพลาด', 'bad'); } finally { btn?.removeAttribute('disabled'); }
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('โหลดสคริปต์ไม่สำเร็จ'));
    document.head.append(s);
  });
}
