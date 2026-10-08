import { api, setToken } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import { busy, formData, langButton } from '../util.js';

export default function login(el, { onLoggedIn }) {
  el.innerHTML = `
    <div class="login-wrap">
      ${langButton('login-lang')}
      <form class="card login-card" autocomplete="on">
        ${mascot('happy', 128)}
        <h1>KaoNgan</h1>
        <p class="muted" style="font-weight:600">${t('เช็คอินเข้างานแบบน่ารัก ๆ')}</p>
        <div class="form">
          <label class="field">${t('ชื่อผู้ใช้')}<span class="input-icon">${icon('user-round', 18)}<input name="username" autocomplete="username" autocapitalize="none" required autofocus></span></label>
          <label class="field">${t('รหัสผ่าน')}<span class="input-icon">${icon('lock', 18)}<input name="password" type="password" autocomplete="current-password" required></span></label>
          <div class="err" role="alert"></div>
          <button class="btn primary block">${icon('log-in', 18)}${t('เข้าสู่ระบบ')}</button>
        </div>
      </form>
    </div>`;
  const form = el.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = form.querySelector('.err');
    err.textContent = '';
    busy(form.querySelector('.btn'), async () => {
      try {
        const r = await api.post('/auth/login', formData(form));
        setToken(r.token);
        await onLoggedIn();
      } catch (ex) { err.textContent = ex.message; }
    });
  });
}
