import { api } from '../api.js';
import { getBackgrounds, applyBg, fileToJpegDataUrl, resetCustomCache } from '../bg.js';
import { LANGS, getLang, setLang, t } from '../i18n.js';
import { icon } from '../icons.js';
import { logout } from '../main.js';
import { avatar, busy, cardTitle, esc, formData, toast } from '../util.js';

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

export default function me(el, { user }) {
  const draw = () => {
    const bgs = getBackgrounds();
    el.innerHTML = `
      <section class="card profile">
        <div class="profile-banner"></div>
        <div class="profile-body">
          ${avatar(user, 72)}
          <div class="meta">
            <b style="font-size:1.15rem">${esc(user.full_name)}</b>${user.nickname ? ` <span class="muted">(${esc(user.nickname)})</span>` : ''}
            <div class="small muted">${esc([user.emp_code && t('รหัส {code}', { code: user.emp_code }), user.position, `@${user.username}`].filter(Boolean).join(' · '))}</div>
          </div>
        </div>
      </section>

      <section class="card">
        ${cardTitle('languages', 'sky', t('ภาษา'))}
        <div class="seg" role="radiogroup" aria-label="${t('ภาษา')}">
          ${Object.entries(LANGS).map(([k, label]) => `<input type="radio" name="lang" id="lg-${k}" value="${k}" ${getLang() === k ? 'checked' : ''}><label for="lg-${k}">${label}</label>`).join('')}
        </div>
      </section>

      <section class="card">
        ${cardTitle('palette', 'pink', t('เลือกพื้นหลัง'))}
        <div class="bg-grid" id="bgs">
          ${bgs.map((p) => `<button class="bg-opt ${user.bg === p.id ? 'active' : ''}" data-bg="${esc(p.id)}"><span class="thumb" style="background-image:url('${esc(p.file)}');${p.thumb ? `background-size:${esc(p.thumb)}` : ''}"></span><span class="name">${esc(getLang() === 'en' ? (p.name_en || p.name) : p.name)}</span>${user.bg === p.id ? `<span class="tick">${icon('check', 14)}</span>` : ''}</button>`).join('')}
          ${user.bg === 'custom' ? `<button class="bg-opt active" data-bg="custom"><span class="thumb" id="custom-thumb"></span><span class="name">${t('รูปของฉัน')}</span><span class="tick">${icon('check', 14)}</span></button>` : ''}
          <label class="bg-opt upload"><span class="thumb">${icon('image', 28)}</span><span class="name">${t('ใช้รูปของฉัน')}</span><input type="file" accept="image/*" hidden id="bg-file"></label>
        </div>
      </section>

      <section class="card">
        ${cardTitle('lock', 'lav', t('เปลี่ยนรหัสผ่าน'))}
        <form class="form" id="pw-form">
          <label class="field">${t('รหัสผ่านปัจจุบัน')}<input type="password" name="current" autocomplete="current-password" required></label>
          <div class="two">
            <label class="field">${t('รหัสผ่านใหม่')}<input type="password" name="next" autocomplete="new-password" minlength="6" required></label>
            <label class="field">${t('ยืนยันรหัสผ่านใหม่')}<input type="password" name="again" autocomplete="new-password" required></label>
          </div>
          <div class="err" role="alert"></div>
          <button class="btn lav">${icon('key-round', 17)}${t('บันทึกรหัสผ่าน')}</button>
        </form>
      </section>

      <section class="card row between">
        ${installEvent ? `<button class="btn" id="install">${icon('smartphone', 17)}${t('ติดตั้งเป็นแอปบนเครื่อง')}</button>` : `<span class="muted small" style="flex:1;min-width:200px">${icon('smartphone', 14)} ${t('เมนูเบราว์เซอร์ → “เพิ่มไปยังหน้าจอหลัก” เพื่อใช้เหมือนแอป')}</span>`}
        <button class="btn danger" id="logout">${icon('log-out', 17)}${t('ออกจากระบบ')}</button>
      </section>`;
    if (user.bg === 'custom') api.blob('/me/bg-image').then((b) => { const thumb = el.querySelector('#custom-thumb'); if (thumb) thumb.style.cssText = `background-image:url(${URL.createObjectURL(b)});background-size:cover`; }).catch(() => {});
  };
  draw();

  async function choose(bg) {
    await api.put('/me/bg', { bg });
    user.bg = bg;
    await applyBg(bg);
    draw();
    toast(t('เปลี่ยนพื้นหลังแล้ว'));
  }

  el.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-bg]');
    if (opt) busy(opt, () => choose(opt.dataset.bg));
    if (e.target.closest('#logout')) logout();
    if (e.target.closest('#install')) { installEvent.prompt(); installEvent = null; }
  });

  el.addEventListener('change', (e) => {
    if (e.target.name === 'lang') { setLang(e.target.value); return; }
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
      toast(t('ใช้รูปของคุณเป็นพื้นหลังแล้ว'));
    });
  });

  el.addEventListener('submit', (e) => {
    if (e.target.id !== 'pw-form') return;
    e.preventDefault();
    const form = e.target;
    const d = formData(form);
    const err = form.querySelector('.err');
    err.textContent = '';
    if (d.next !== d.again) { err.textContent = t('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'); return; }
    busy(form.querySelector('.btn'), async () => {
      try { await api.post('/me/password', { current: d.current, next: d.next }); form.reset(); toast(t('เปลี่ยนรหัสผ่านแล้ว')); } catch (ex) { err.textContent = ex.message; }
    });
  });
}
