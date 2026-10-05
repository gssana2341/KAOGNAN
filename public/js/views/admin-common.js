import { api } from '../api.js';
import { esc } from '../util.js';

const TABS = [
  ['/admin', 'ภาพรวม'],
  ['/admin/users', 'พนักงาน'],
  ['/admin/attendance', 'เวลาเข้างาน & Excel'],
  ['/admin/leaves', 'ใบลา'],
  ['/admin/settings', 'ตั้งค่า & QR'],
];

export const adminTabs = (active) => `
  <nav class="chips no-print" aria-label="เมนูผู้ดูแล">
    ${TABS.map(([p, label]) => `<a href="#${p}" class="${p === active ? 'active' : ''}">${label}${p === '/admin/leaves' ? '<span class="dot" data-pending hidden></span>' : ''}</a>`).join('')}
  </nav>`;

let usersCache = null;
export async function loadUsers(force = false) {
  if (!usersCache || force) usersCache = (await api.get('/admin/users')).users;
  return usersCache;
}
export const invalidateUsers = () => { usersCache = null; };

export const userLabel = (u) => `${u.emp_code ? u.emp_code + ' · ' : ''}${u.full_name}`;
export const initial = (u) => esc((u.nickname || u.full_name)[0] ?? '?');
