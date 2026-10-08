import { api } from '../api.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
import { avatar, badge, busy, cardTitle, esc, formData, openModal, skeleton, toast } from '../util.js';
import { adminTabs, invalidateUsers, loadUsers } from './admin-common.js';

export default function users(el, { user: me }) {
  let list = [];
  let q = '';

  const draw = () => {
    const shown = list.filter((u) => `${u.full_name} ${u.nickname} ${u.emp_code} ${u.username}`.toLowerCase().includes(q));
    el.innerHTML = `
      ${adminTabs('/admin/users')}
      <section class="card">
        ${cardTitle('users', 'pink', t('พนักงาน ({n} คน)', { n: list.filter((u) => u.active).length }), `<button class="btn primary small" id="add">${icon('plus', 16)}${t('เพิ่มพนักงาน')}</button>`)}
        <div class="input-icon" style="margin-bottom:12px">${icon('search', 18)}<input type="search" id="q" placeholder="${t('ค้นหาชื่อ / รหัส / ชื่อผู้ใช้')}" value="${esc(q)}"></div>
        <div class="list">
          ${shown.length ? shown.map((u) => `
            <div class="item clickable" data-edit="${u.id}" style="${u.active ? '' : 'opacity:.55'}">
              <div class="person grow">${avatar(u)}
                <div style="min-width:0"><b>${esc(u.full_name)}</b>${u.nickname ? ` <span class="muted">(${esc(u.nickname)})</span>` : ''}
                  <div class="small muted">${esc([u.emp_code, u.position, '@' + u.username].filter(Boolean).join(' · '))}</div></div></div>
              <div class="stack" style="align-items:flex-end;gap:4px">
                ${u.role === 'admin' ? badge(t('แอดมิน'), 'pink', 'shield-check') : ''}${u.active ? '' : badge(t('ปิดใช้งาน'), 'mute')}${u.must_change_password ? badge(t('รหัสชั่วคราว'), 'warn', 'key-round') : ''}
              </div>
            </div>`).join('') : `<div class="empty">${mascot('sleepy', 90)}<p>${t('ไม่พบพนักงาน')}</p></div>`}
        </div>
      </section>`;
    const input = el.querySelector('#q');
    input.addEventListener('input', () => { q = input.value.trim().toLowerCase(); const pos = input.selectionStart; draw(); const n = el.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); });
  };

  function openForm(u) {
    const editing = !!u;
    const m = openModal(`
      <h2>${editing ? t('แก้ไขพนักงาน') : t('เพิ่มพนักงานใหม่')}</h2>
      <form class="form">
        <div class="two">
          <label class="field">${t('ชื่อ-นามสกุล *')}<input name="full_name" value="${esc(u?.full_name)}" maxlength="80" required></label>
          <label class="field">${t('ชื่อเล่น')}<input name="nickname" value="${esc(u?.nickname)}" maxlength="50"></label>
        </div>
        <div class="two">
          <label class="field">${t('รหัสพนักงาน')}<input name="emp_code" value="${esc(u?.emp_code)}" maxlength="50"></label>
          <label class="field">${t('ตำแหน่ง')}<input name="position" value="${esc(u?.position)}" maxlength="50"></label>
        </div>
        <div class="two">
          <label class="field">${t('ชื่อผู้ใช้ (ใช้ล็อกอิน) *')}<input name="username" value="${esc(u?.username)}" pattern="[A-Za-z0-9._\\-]{3,30}" title="${t('อังกฤษ/ตัวเลข 3-30 ตัว')}" autocapitalize="none" required></label>
          <label class="field">${editing ? t('ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)') : t('รหัสผ่านเริ่มต้น *')}<input name="password" type="text" minlength="6" autocomplete="off" ${editing ? '' : 'required'} placeholder="${t('อย่างน้อย 6 ตัว')}"></label>
        </div>
        <label class="field">${t('สิทธิ์')}
          <select name="role"><option value="employee" ${u?.role !== 'admin' ? 'selected' : ''}>${t('พนักงาน')}</option><option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>${t('ผู้ดูแลระบบ')}</option></select>
        </label>
        <label class="check"><input type="checkbox" name="track" ${u?.track ?? true ? 'checked' : ''}> ${t('นับเวลาเข้างานของคนนี้ในรายงาน/Excel')}</label>
        ${editing ? `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${u.id === me.id ? 'disabled' : ''}> ${t('เปิดใช้งานบัญชี')}</label>` : ''}
        <p class="small muted">${t('พนักงานจะถูกบังคับให้ตั้งรหัสผ่านใหม่ตอนเข้าใช้งานครั้งแรก (เมื่อแอดมินตั้งรหัสให้)')}</p>
        <div class="err" role="alert"></div>
        <div class="row end"><button type="button" class="btn" data-close>${t('ยกเลิก')}</button><button class="btn primary">${icon('check', 17)}${editing ? t('บันทึก') : t('เพิ่มพนักงาน')}</button></div>
      </form>`);
    const form = m.el.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = form.querySelector('.err');
      err.textContent = '';
      busy(form.querySelector('.btn.primary'), async () => {
        const d = formData(form);
        if (editing && u.id === me.id) delete d.active;
        try {
          if (editing) await api.put(`/admin/users/${u.id}`, d); else await api.post('/admin/users', d);
          m.close();
          toast(editing ? t('บันทึกแล้ว') : t('เพิ่มพนักงานแล้ว'));
          invalidateUsers();
          list = await loadUsers(true);
          draw();
        } catch (ex) { err.textContent = ex.message; }
      });
    });
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('#add')) return openForm(null);
    const row = e.target.closest('[data-edit]');
    if (row) openForm(list.find((u) => u.id === Number(row.dataset.edit)));
  });

  el.innerHTML = adminTabs('/admin/users') + skeleton(2);
  loadUsers(true).then((l) => { list = l; draw(); }).catch((e) => { el.innerHTML = `${adminTabs('/admin/users')}<div class="card empty">${esc(e.message)}</div>`; });
}
