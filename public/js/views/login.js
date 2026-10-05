import { api, setToken } from '../api.js';
import { mascot } from '../mascot.js';
import { busy, formData } from '../util.js';

export default function login(el, { onLoggedIn }) {
  el.innerHTML = `
    <div class="login-wrap">
      <form class="card login-card" autocomplete="on">
        ${mascot('sleepy', 110)}
        <h1>KaoNgan</h1>
        <p class="muted">เช็คอินเข้างานแบบน่ารัก ๆ</p>
        <div class="form">
          <label class="field">ชื่อผู้ใช้<input name="username" autocomplete="username" autocapitalize="none" required autofocus></label>
          <label class="field">รหัสผ่าน<input name="password" type="password" autocomplete="current-password" required></label>
          <div class="err" role="alert"></div>
          <button class="btn primary block">เข้าสู่ระบบ</button>
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
