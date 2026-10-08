import { api } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';

const tabs = () => [
  ['/admin', 'layout-dashboard', t('ภาพรวม')],
  ['/admin/users', 'users', t('พนักงาน')],
  ['/admin/attendance', 'file-spreadsheet', t('เวลา & Excel')],
  ['/admin/leaves', 'calendar-check', t('ใบลา')],
  ['/admin/settings', 'settings', t('ตั้งค่า & QR')],
];

export const adminTabs = (active) => `
  <nav class="chips scroll no-print" aria-label="${t('เมนูผู้ดูแล')}">
    ${tabs().map(([p, ic, label]) => `<a href="#${p}" class="${p === active ? 'active' : ''}">${icon(ic, 16)}${label}${p === '/admin/leaves' ? '<span class="dot" data-pending hidden></span>' : ''}</a>`).join('')}
  </nav>`;

let usersCache = null;
export async function loadUsers(force = false) {
  if (!usersCache || force) usersCache = (await api.get('/admin/users')).users;
  return usersCache;
}
export const invalidateUsers = () => { usersCache = null; };

export const userLabel = (u) => `${u.emp_code ? u.emp_code + ' · ' : ''}${u.full_name}`;
