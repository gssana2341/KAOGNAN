import { api } from '../api.js';
import { mascot } from '../mascot.js';
import { badge, busy, esc, formData, openModal, toast } from '../util.js';
import { adminTabs, initial, invalidateUsers, loadUsers } from './admin-common.js';

export default function users(el, { user: me }) {
  let list = [];
  let q = '';

  const draw = () => {
    const shown = list.filter((u) => `${u.full_name} ${u.nickname} ${u.emp_code} ${u.username}`.toLowerCase().includes(q));
    el.innerHTML = `
      ${adminTabs('/admin/users')}
      <section class="card">
        <div class="card-title"><h2>👥 พนักงาน (${list.filter((u) => u.active).length} คน)</h2><button class="btn primary small" id="add">＋ เพิ่มพนักงาน</button></div>
        <input type="search" id="q" placeholder="ค้นหาชื่อ / รหัส / ชื่อผู้ใช้" value="${esc(q)}" style="margin-bottom:10px">
        <div class="list">
          ${shown.length ? shown.map((u) => `
            <div class="item clickable" data-edit="${u.id}" style="${u.active ? '' : 'opacity:.55'}">
              <div class="person grow"><div class="avatar">${initial(u)}</div>
                <div><b>${esc(u.full_name)}</b>${u.nickname ? ` <span class="muted">(${esc(u.nickname)})</span>` : ''}
                  <div class="small muted">${esc([u.emp_code, u.position, '@' + u.username].filter(Boolean).join(' · '))}</div></div></div>
              <div class="stack" style="align-items:flex-end;gap:4px">
                ${u.role === 'admin' ? badge('แอดมิน', 'pink') : ''}${u.active ? '' : badge('ปิดใช้งาน', 'mute')}${u.must_change_password ? badge('รหัสชั่วคราว', 'warn') : ''}
              </div>
            </div>`).join('') : `<div class="empty">${mascot('sleepy', 80)}<p>ไม่พบพนักงาน</p></div>`}
        </div>
      </section>`;
    const input = el.querySelector('#q');
    input.addEventListener('input', () => { q = input.value.trim().toLowerCase(); const pos = input.selectionStart; draw(); const n = el.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); });
  };

  function openForm(u) {
    const editing = !!u;
    const m = openModal(`
      <h2>${editing ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
      <form class="form">
        <div class="two">
          <label class="field">ชื่อ-นามสกุล *<input name="full_name" value="${esc(u?.full_name)}" maxlength="80" required></label>
          <label class="field">ชื่อเล่น<input name="nickname" value="${esc(u?.nickname)}" maxlength="50"></label>
        </div>
        <div class="two">
          <label class="field">รหัสพนักงาน<input name="emp_code" value="${esc(u?.emp_code)}" maxlength="50"></label>
          <label class="field">ตำแหน่ง<input name="position" value="${esc(u?.position)}" maxlength="50"></label>
        </div>
        <div class="two">
          <label class="field">ชื่อผู้ใช้ (ใช้ล็อกอิน) *<input name="username" value="${esc(u?.username)}" pattern="[A-Za-z0-9._\\-]{3,30}" title="อังกฤษ/ตัวเลข 3-30 ตัว" autocapitalize="none" required></label>
          <label class="field">${editing ? 'ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น *'}<input name="password" type="text" minlength="6" autocomplete="off" ${editing ? '' : 'required'} placeholder="อย่างน้อย 6 ตัว"></label>
        </div>
        <label class="field">สิทธิ์
          <select name="role"><option value="employee" ${u?.role !== 'admin' ? 'selected' : ''}>พนักงาน</option><option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select>
        </label>
        <label class="check"><input type="checkbox" name="track" ${u?.track ?? true ? 'checked' : ''}> นับเวลาเข้างานของคนนี้ในรายงาน/Excel</label>
        ${editing ? `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${u.id === me.id ? 'disabled' : ''}> เปิดใช้งานบัญชี</label>` : ''}
        <p class="small muted">พนักงานจะถูกบังคับให้ตั้งรหัสผ่านใหม่ตอนเข้าใช้งานครั้งแรก (เมื่อแอดมินตั้งรหัสให้)</p>
        <div class="err" role="alert"></div>
        <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">${editing ? 'บันทึก' : 'เพิ่มพนักงาน'}</button></div>
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
          toast(editing ? 'บันทึกแล้ว' : 'เพิ่มพนักงานแล้ว 🎉');
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

  loadUsers(true).then((l) => { list = l; draw(); }).catch((e) => { el.innerHTML = `${adminTabs('/admin/users')}<div class="card empty">${esc(e.message)}</div>`; });
}
