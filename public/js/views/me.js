import { api } from '../api.js';
import { PRESETS, applyBg, fileToJpegDataUrl, resetCustomCache } from '../bg.js';
import { logout } from '../main.js';
import { busy, esc, formData, toast } from '../util.js';

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

export default function me(el, { user }) {
  const draw = () => {
    el.innerHTML = `
      <section class="card">
        <div class="person">
          <div class="avatar" style="width:54px;height:54px;font-size:1.4rem">${esc((user.nickname || user.full_name)[0])}</div>
          <div>
            <b style="font-size:1.1rem">${esc(user.full_name)}</b>${user.nickname ? ` <span class="muted">(${esc(user.nickname)})</span>` : ''}
            <div class="small muted">${esc([user.emp_code && `รหัส ${user.emp_code}`, user.position, `@${user.username}`].filter(Boolean).join(' · '))}</div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-title"><h3>🎨 เลือกพื้นหลัง</h3></div>
        <div class="bg-grid" id="bgs">
          ${PRESETS.map((p) => `<button class="bg-opt ${user.bg === p.id ? 'active' : ''}" data-bg="${p.id}"><span class="thumb" style="background-image:url('/bg/${p.id}.svg')"></span><span>${p.name}</span></button>`).join('')}
          ${user.bg === 'custom' ? `<button class="bg-opt active" data-bg="custom"><span class="thumb" id="custom-thumb"></span><span>รูปของฉัน</span></button>` : ''}
          <label class="bg-opt upload"><span class="thumb">📷</span><span>ใช้รูปของฉัน</span><input type="file" accept="image/*" hidden id="bg-file"></label>
        </div>
      </section>

      <section class="card">
        <div class="card-title"><h3>🔒 เปลี่ยนรหัสผ่าน</h3></div>
        <form class="form" id="pw-form">
          <label class="field">รหัสผ่านปัจจุบัน<input type="password" name="current" autocomplete="current-password" required></label>
          <div class="two">
            <label class="field">รหัสผ่านใหม่<input type="password" name="next" autocomplete="new-password" minlength="6" required></label>
            <label class="field">ยืนยันรหัสผ่านใหม่<input type="password" name="again" autocomplete="new-password" required></label>
          </div>
          <div class="err" role="alert"></div>
          <button class="btn primary">บันทึกรหัสผ่าน</button>
        </form>
      </section>

      <section class="card row between">
        ${installEvent ? '<button class="btn" id="install">📲 ติดตั้งเป็นแอปบนเครื่อง</button>' : '<span class="muted small">เมนูเบราว์เซอร์ → “เพิ่มไปยังหน้าจอหลัก” เพื่อใช้เหมือนแอป</span>'}
        <button class="btn danger" id="logout">ออกจากระบบ</button>
      </section>`;
    if (user.bg === 'custom') api.blob('/me/bg-image').then((b) => { const t = el.querySelector('#custom-thumb'); if (t) t.style.cssText = `background:url(${URL.createObjectURL(b)}) center/cover`; }).catch(() => {});
  };
  draw();

  async function choose(bg) {
    await api.put('/me/bg', { bg });
    user.bg = bg;
    await applyBg(bg);
    draw();
    toast('เปลี่ยนพื้นหลังแล้ว 💕');
  }

  el.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-bg]');
    if (opt) busy(opt, () => choose(opt.dataset.bg));
    if (e.target.closest('#logout')) logout();
    if (e.target.closest('#install')) { installEvent.prompt(); installEvent = null; }
  });

  el.addEventListener('change', (e) => {
    if (e.target.id !== 'bg-file' || !e.target.files[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    busy(null, async () => {
      const image = await fileToJpegDataUrl(file);
      await api.post('/me/bg-image', { image });
      resetCustomCache();
      user.bg = 'custom';
      await applyBg('custom');
      draw();
      toast('ใช้รูปของคุณเป็นพื้นหลังแล้ว 💕');
    });
  });

  el.addEventListener('submit', (e) => {
    if (e.target.id !== 'pw-form') return;
    e.preventDefault();
    const form = e.target;
    const d = formData(form);
    const err = form.querySelector('.err');
    err.textContent = '';
    if (d.next !== d.again) { err.textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
    busy(form.querySelector('.btn'), async () => {
      try { await api.post('/me/password', { current: d.current, next: d.next }); form.reset(); toast('เปลี่ยนรหัสผ่านแล้ว 🔒'); } catch (ex) { err.textContent = ex.message; }
    });
  });
}
