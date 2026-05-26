async function renderUsuarios() {
  const el = document.getElementById('view-usuarios');
  el.innerHTML = `<div class="spinner"></div>`;
  try {
    const users = await API.get('/usuarios');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Usuarios</div>
          <div class="page-subtitle">Gestión de accesos al sistema</div>
        </div>
        <button class="btn btn-gold" onclick="openNuevoUsuario()">+ Nuevo Usuario</button>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Estado</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${u.nombre[0].toUpperCase()}</div>
                      <span style="font-weight:600;">${u.nombre}</span>
                    </div>
                  </td>
                  <td style="font-size:13px;">${u.email}</td>
                  <td><span class="badge" style="background:${u.rol==='admin'?'var(--red-light)':u.rol==='coordinador'?'#fef3c7':'var(--blue-light)'};color:${u.rol==='admin'?'var(--red)':u.rol==='coordinador'?'#92400e':'var(--blue)'};">${{admin:'Administrador',coordinador:'Coordinador',notificador:'Notificador',usuario:'Usuario'}[u.rol]||u.rol}</span></td>
                  <td style="font-size:13px;">${u.area || '—'}</td>
                  <td>${u.activo ? '<span class="badge" style="background:var(--green-light);color:var(--green);">Activo</span>' : '<span class="badge" style="background:var(--gray-100);color:var(--gray-500);">Inactivo</span>'}</td>
                  <td style="font-size:12px;color:var(--gray-500);">${formatDate(u.created_at)}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="openEditUsuario(${u.id}, '${u.nombre}', '${u.rol}', '${u.area||''}', ${u.activo})">Editar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function openNuevoUsuario() {
  openModal('Nuevo Usuario', `
    <form id="form-usuario">
      <div class="form-grid">
        <div class="field-group full-width"><label>Nombre completo <span class="req">*</span></label><input type="text" name="nombre" required></div>
        <div class="field-group full-width"><label>Correo electrónico <span class="req">*</span></label><input type="email" name="email" required></div>
        <div class="field-group full-width"><label>Contraseña <span class="req">*</span></label><input type="password" name="password" required minlength="8"></div>
        <div class="field-group">
          <label>Rol</label>
          <select name="rol">
            <option value="usuario">Usuario</option>
            <option value="notificador">Notificador</option>
            <option value="coordinador">Coordinador</option>
          </select>
        </div>
        <div class="field-group">
          <label>Área</label>
          <select name="area">
            <option value="">— Sin área —</option>
            ${AREAS.map(a => `<option value="${a}">${a}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="usr-error" class="alert alert-error" style="display:none;margin-top:16px;"></div>
      <div class="btn-group" style="margin-top:20px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Crear Usuario</button>
      </div>
    </form>
  `);

  document.getElementById('form-usuario').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('usr-error');
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await API.post('/usuarios', data);
      closeModal();
      toast('Usuario creado exitosamente', 'success');
      renderUsuarios();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

function openEditUsuario(id, nombre, rol, area, activo) {
  openModal('Editar Usuario', `
    <form id="form-edit-usuario">
      <div class="form-grid">
        <div class="field-group full-width"><label>Nombre</label><input type="text" name="nombre" value="${nombre}" required></div>
        <div class="field-group">
          <label>Rol</label>
          <select name="rol">
            <option value="usuario" ${rol==='usuario'?'selected':''}>Usuario</option>
            <option value="notificador" ${rol==='notificador'?'selected':''}>Notificador</option>
            <option value="coordinador" ${rol==='coordinador'?'selected':''}>Coordinador</option>
          </select>
        </div>
        <div class="field-group">
          <label>Área</label>
          <select name="area">
            <option value="">— Sin área —</option>
            ${AREAS.map(a => `<option value="${a}" ${area===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="toggle-row full-width">
          <label>Usuario activo</label>
          <label class="toggle"><input type="checkbox" name="activo" ${activo?'checked':''}><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="btn-group" style="margin-top:20px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
      </div>
    </form>
  `);

  document.getElementById('form-edit-usuario').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.activo = e.target.querySelector('[name=activo]').checked;
    try {
      await API.patch(`/usuarios/${id}`, data);
      closeModal();
      toast('Usuario actualizado', 'success');
      renderUsuarios();
    } catch(err) {
      toast(err.message, 'error');
    }
  };
}
