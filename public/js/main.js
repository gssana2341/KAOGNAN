import { api, hasToken, setToken, setUnauthorizedHandler } from './api.js';
import { loadAssets } from './assets.js';
import { applyBg, lastBg, resetCustomCache } from './bg.js';
import { icon } from './icons.js';
import { $, $$, avatar, displayName, esc, skeleton } from './util.js';

const state = { user: null, pendingBadge: 0 };

// route table: hash -> lazy view module. `admin` routes need the admin role.
const ROUTES = {
  '/home': { load: () => import('./views/home.js'), tab: 'home' },
  '/history': { load: () => import('./views/history.js'), tab: 'history' },
  '/leave': { load: () => import('./views/leave.js'), tab: 'leave' },
  '/me': { load: () => import('./views/me.js'), tab: 'me' },
  '/admin': { load: () => import('./views/admin-dashboard.js'), tab: 'admin', admin: true },
  '/admin/users': { load: () => import('./views/admin-users.js'), tab: 'admin', admin: true },
  '/admin/attendance': { load: () => import('./views/admin-attendance.js'), tab: 'admin', admin: true },
  '/admin/leaves': { load: () => import('./views/admin-leaves.js'), tab: 'admin', admin: true },
  '/admin/settings': { load: () => import('./views/admin-settings.js'), tab: 'admin', admin: true },
  '/qr': { load: () => import('./views/qr-screen.js'), tab: 'admin', admin: true, bare: true },
};

const app = $('#app');
let cleanup = null;
let renderToken = 0;

export const navigate = (path) => { location.hash = '#' + path; };
const currentPath = () => (location.hash.slice(1) || '/home').split('?')[0];
export const getUser = () => state.user;
export const refreshUser = async () => {
  const me = await api.get('/me');
  state.user = me.user;
  await applyBg(me.user.bg);
  return me;
};
export const setPendingBadge = (n) => { state.pendingBadge = n; $$('.dot[data-pending]').forEach((d) => { d.textContent = n; d.hidden = !n; }); };

export function logout() {
  api.post('/auth/logout').catch(() => {});
  setToken(null);
  state.user = null;
  resetCustomCache();
  applyBg(lastBg());
  navigate('/login');
}
setUnauthorizedHandler(() => { state.user = null; navigate('/login'); render(); });

function navItems(user) {
  const items = [
    { tab: 'home', href: '#/home', icon: 'house', label: 'หน้าหลัก' },
    { tab: 'history', href: '#/history', icon: 'calendar-days', label: 'ประวัติ' },
    { tab: 'leave', href: '#/leave', icon: 'tree-palm', label: 'ลางาน' },
  ];
  if (user.role === 'admin') items.push({ tab: 'admin', href: '#/admin', icon: 'layout-dashboard', label: 'จัดการ', pending: true });
  items.push({ tab: 'me', href: '#/me', icon: 'user-round', label: 'ฉัน' });
  return items;
}

function shell(user, activeTab) {
  const items = navItems(user);
  const dot = (it) => (it.pending ? `<span class="dot" data-pending ${state.pendingBadge ? '' : 'hidden'}>${state.pendingBadge}</span>` : '');
  const link = (i, size) => `<a href="${i.href}" class="${i.tab === activeTab ? 'active' : ''}">${icon(i.icon, size)}<span>${i.label}</span>${dot(i)}</a>`;
  return `
    <header class="topbar no-print">
      <a class="brand" href="#/home"><img src="/icons/icon-192.png" alt="">KaoNgan</a>
      <nav class="topnav">${items.map((i) => link(i, 18)).join('')}</nav>
      <a class="who" href="#/me" aria-label="โปรไฟล์">${avatar(user, 34)}<span>${esc(displayName(user))}</span></a>
    </header>
    <main class="page" id="view"></main>
    <nav class="tabbar no-print">${items.map((i) => link(i, 23)).join('')}</nav>`;
}

async function render() {
  const token = ++renderToken;
  cleanup?.();
  cleanup = null;
  const path = currentPath();

  if (!hasToken()) {
    if (path !== '/login') return navigate('/login');
    const view = await import('./views/login.js');
    app.innerHTML = '';
    return void (cleanup = view.default(app, { onLoggedIn: async () => { await boot(); } }));
  }
  if (!state.user) {
    try { await refreshUser(); } catch { return navigate('/login'); }
    if (token !== renderToken) return;
  }
  if (state.user.must_change_password) {
    const view = await import('./views/force-password.js');
    app.innerHTML = '';
    return void (cleanup = view.default(app, { onDone: async () => { await refreshUser(); navigate('/home'); render(); } }));
  }

  const route = ROUTES[path] ?? ROUTES['/home'];
  if (path === '/login') return navigate('/home');
  if (route.admin && state.user.role !== 'admin') return navigate('/home');
  const mod = await route.load();
  if (token !== renderToken) return;

  if (route.bare) {
    app.innerHTML = '<main id="view"></main>';
  } else {
    app.innerHTML = shell(state.user, route.tab);
    $('#view').innerHTML = skeleton(2);
    if (state.user.role === 'admin') api.get('/admin/leaves?status=pending').then((r) => setPendingBadge(r.leaves.length)).catch(() => {});
  }
  window.scrollTo(0, 0);
  const result = mod.default($('#view'), { user: state.user, navigate, path });
  cleanup = typeof result === 'function' ? result : null;
}

async function boot() {
  state.user = null;
  await loadAssets();
  if (hasToken()) { try { await refreshUser(); } catch { /* handled by render */ } }
  else await applyBg(lastBg());
  if (currentPath() === '/login' && hasToken()) navigate('/home');
  render();
}

window.addEventListener('hashchange', render);
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
