async function renderDetalle(id) {
  const el = document.getElementById('view-detalle');
  el.innerHTML = `<div class="spinner"></div>`;
  try {
    const d = await API.get(`/diligencias/${id}`);
    const days = daysUntil(d.termino_fecha);
    const tieneFinal = d.seguimiento.some(s => s.tipo === 'final');
    const seguimientoFinal = d.seguimiento.find(s => s.tipo === 'final');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-outline btn-sm" onclick="navigate('lista')" style="margin-bottom:8px;">← Regresar</button>
          <div class="page-title">${d.folio}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
            ${estadoBadge(d.estado)}
            ${d.tiene_termino_legal ? terminoBadge(d) : ''}
            ${d.tiene_anexos ? '<span class="badge" style="background:var(--blue-light);color:var(--blue);">📎 Con Anexos</span>' : ''}
          </div>
        </div>
        <div class="btn-group">
          ${(currentUser && (currentUser.id === d.creado_por || currentUser.rol === 'admin' || currentUser.rol === 'coordinador')) ? `<button class="btn btn-outline" onclick="openEditarModal(${d.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:5px;vertical-align:middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>` : ''}
          ${['admin','coordinador','notificador'].includes(currentUser?.rol) ? `
          <select id="cambio-estado" onchange="cambiarEstado(${d.id}, this.value, ${tieneFinal})" class="btn btn-outline">
            <option value="">Cambiar estado...</option>
            ${(currentUser?.id === d.creado_por
                ? ['pendiente','en_proceso','entregado','no_entregado','cancelado']
                : ['pendiente','en_proceso','entregado','no_entregado']
              ).map(e =>
                `<option value="${e}" ${d.estado===e?'selected':''}>${{pendiente:'Pendiente',en_proceso:'En Proceso',entregado:'Entregado',no_entregado:'No Entregado',cancelado:'Cancelado'}[e]}</option>`
            ).join('')}
          </select>` : ''}
          ${!['entregado','cancelado'].includes(d.estado) ? `<button class="btn btn-primary" onclick="openSeguimientoModal(${d.id})">📦 Registrar Tramo</button>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">
        <div>
          <!-- Documento -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>Datos del Documento</h3></div>
            <div class="card-body">
              <div class="detail-grid">
                <div class="detail-item"><label>Número de Oficio</label><span style="font-weight:700;font-size:16px;">${d.numero_oficio}</span></div>
                <div class="detail-item"><label>ID SAI</label><span>${d.id_sai || '—'}</span></div>
                <div class="detail-item"><label>Área Requirente</label><span>${d.area_requirente}</span></div>
                <div class="detail-item"><label>Registrado</label><span>${formatDatetime(d.created_at)}</span></div>
                <div class="detail-item"><label>Registrado por</label><span>${d.creado_por_nombre || '—'}</span></div>
                ${d.instrucciones_adicionales ? `<div class="detail-item" style="grid-column:1/-1;"><label>Instrucciones Adicionales</label><span style="white-space:pre-wrap;">${d.instrucciones_adicionales}</span></div>` : ''}
              </div>
            </div>
          </div>

          <!-- Anexos checklist -->
          ${d.tiene_anexos ? `
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>📋 Actividades a realizar</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
                ${[
                  [d.anexo_firma_deaj, '<u><strong>Recabar firma autógrafa del DEAJ</strong></u> (hoja verde)'],
                  [d.anexo_imprimir,   '<strong>Imprimir anexo</strong>'],
[d.anexo_digitalizar,'Digitalizar'],
                  [d.anexo_quemar_cd,  'Quemar CD'],
                  [d.anexo_usb,        'USB'],
                ].map(([val, label]) => `
                  <div style="display:flex;align-items:flex-start;gap:8px;">
                    <span style="flex-shrink:0;font-size:15px;">${val ? '☑' : '☐'}</span>
                    <span style="color:${val ? 'inherit' : '#9ca3af'}">${label}</span>
                  </div>`).join('')}
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="flex-shrink:0;font-size:15px;">${d.anexo_sobre_cerrado ? '☑' : '☐'}</span>
                  <span>Guardar en sobre cerrado:
                    <strong style="margin-left:6px;">${d.anexo_sobre_cerrado ? d.anexo_sobre_cerrado : '—'}</strong>
                  </span>
                </div>
                ${d.anexo_otro ? `
                <div style="display:flex;align-items:flex-start;gap:8px;">
                  <span style="flex-shrink:0;font-size:15px;">☑</span>
                  <span>Otro: <strong>${d.anexo_otro}</strong></span>
                </div>` : ''}
              </div>
            </div>
          </div>` : ''}

          <!-- Tantos a imprimir -->
          ${(d.tantos_original || d.tantos_acuse || d.tantos_copias_conocimiento || d.tantos_traslados) ? `
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>🖨️ Número de tantos a imprimir</h3></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
                ${[
                  [d.tantos_original,            'Original'],
                  [d.tantos_acuse,               'Acuse'],
                  [d.tantos_copias_conocimiento, 'Copias conocimiento'],
                  [d.tantos_traslados,           'Traslados'],
                ].map(([val, label]) => val > 0 ? `
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:15px;">☑</span>
                    <span style="min-width:160px;">${label}</span>
                    <strong>${val}</strong>
                  </div>` : `
                  <div style="display:flex;align-items:center;gap:10px;color:#9ca3af;">
                    <span style="font-size:15px;">☐</span>
                    <span>${label}</span>
                  </div>`).join('')}
              </div>
            </div>
          </div>` : ''}

          <!-- Documentos adjuntos -->
          ${d.documentos && d.documentos.length > 0 ? `
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>📎 Documentos Adjuntos (${d.documentos.length})</h3></div>
            <div class="card-body">
              <div class="doc-list">
                ${d.documentos.map(doc => `
                  <a href="/api/dil${doc.archivo}" target="_blank" class="doc-item">
                    <span class="doc-item-icon">${docIcon(doc.nombre_original)}</span>
                    <span class="doc-item-name" title="${doc.nombre_original}">${doc.nombre_original}</span>
                    <span class="doc-item-meta">${doc.tamanio ? dzSizeDetalle(doc.tamanio) : ''}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-dim);flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                `).join('')}
              </div>
            </div>
          </div>` : ''}

          <!-- Autoridad -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>Autoridad a Notificar</h3></div>
            <div class="card-body">
              <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:12px;">${d.autoridad_nombre}</div>
              <div style="font-size:14px;line-height:1.8;color:var(--gray-700);">
                ${d.autoridad_domicilio}${d.autoridad_colonia ? `, Col. ${d.autoridad_colonia}` : ''}
                ${d.autoridad_municipio ? `<br>${d.autoridad_municipio}` : ''}
                ${d.autoridad_estado ? `, ${d.autoridad_estado}` : ''}
                ${d.autoridad_cp ? ` C.P. ${d.autoridad_cp}` : ''}
              </div>
              ${d.autoridad_referencia ? `<div style="margin-top:10px;padding:10px;background:var(--gray-50);border-radius:var(--radius-sm);font-size:13px;color:var(--gray-500);">📍 ${d.autoridad_referencia}</div>` : ''}
              <div style="margin-top:12px;">
                <a href="https://maps.google.com/?q=${encodeURIComponent(d.autoridad_domicilio + ' ' + (d.autoridad_municipio||'') + ' ' + (d.autoridad_estado||''))}" target="_blank" class="btn btn-outline btn-sm">🗺️ Ver en Google Maps</a>
              </div>
            </div>
          </div>

          <!-- Seguimiento -->
          <div class="card">
            <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
              <h3>Historial de Seguimiento</h3>
              ${!['entregado','cancelado'].includes(d.estado) ? `<button class="btn btn-primary btn-sm" onclick="openSeguimientoModal(${d.id})">📦 Registrar Tramo</button>` : ''}
            </div>
            <div class="card-body">
              ${buildHistorial(d.seguimiento)}
            </div>
          </div>
        </div>

        <!-- Sidebar detalle -->
        <div>
          ${d.tiene_termino_legal ? `
          <div class="card" style="margin-bottom:16px;border:1.5px solid ${d.estado==='entregado' ? 'var(--gray-200)' : days <= 0 ? 'var(--red)' : days <= 3 ? 'var(--orange)' : 'var(--gray-200)'};">
            <div class="card-header" style="background:${d.estado==='entregado' ? 'var(--gray-50)' : days <= 0 ? 'var(--red-light)' : days <= 3 ? 'var(--orange-light)' : 'var(--gray-50)'};">
              <h3>⚖️ Término Legal</h3>
            </div>
            <div class="card-body">
              <div class="detail-item" style="margin-bottom:10px;"><label>Fecha Límite</label><span style="font-weight:700;">${formatDate(d.termino_fecha)}</span></div>
              ${d.termino_hora ? `<div class="detail-item" style="margin-bottom:10px;"><label>Hora Límite</label><span>${d.termino_hora}</span></div>` : ''}
              ${days !== null ? `<div style="margin:12px 0;">${terminoBadge(d)}</div>` : ''}
              ${d.termino_observaciones ? `<div style="font-size:13px;color:var(--gray-600);padding:10px;background:var(--gray-50);border-radius:var(--radius-sm);">${d.termino_observaciones}</div>` : ''}
            </div>
          </div>` : ''}

          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3>Contacto Solicitante</h3></div>
            <div class="card-body">
              ${d.contacto_nombre ? `<div class="detail-item" style="margin-bottom:8px;"><label>Nombre</label><span>${d.contacto_nombre}</span></div>` : ''}
              ${d.contacto_email ? `<div class="detail-item" style="margin-bottom:8px;"><label>Email</label><a href="mailto:${d.contacto_email}" style="color:var(--navy);">${d.contacto_email}</a></div>` : ''}
              ${d.contacto_telefono ? `<div class="detail-item"><label>Teléfono</label><span>${d.contacto_telefono}</span></div>` : ''}
              ${!d.contacto_nombre && !d.contacto_email && !d.contacto_telefono ? '<p style="color:var(--gray-500);font-size:13px;">Sin datos de contacto</p>' : ''}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
              <h3>Notificador Asignado</h3>
              ${currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'coordinador') ? `
              <button class="btn btn-outline btn-sm" onclick="openAsignarModal(${d.id}, '${d.folio}', ${d.asignado_a || 'null'})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Cambiar
              </button>` : ''}
            </div>
            <div class="card-body">
              ${d.asignado_a_nombre
                ? `<div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:#0369a1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;">${d.asignado_a_nombre[0].toUpperCase()}</div>
                    <span style="font-weight:600;font-size:14px;">${d.asignado_a_nombre}</span>
                  </div>`
                : `<p style="color:var(--gray-500);font-size:13px;">Sin notificador asignado</p>`}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Estado Actual</h3></div>
            <div class="card-body" style="text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">${{pendiente:'⏳',en_proceso:'🔄',entregado:'✅',no_entregado:'❌',cancelado:'🚫'}[d.estado]}</div>
              ${estadoBadge(d.estado)}
              <div style="font-size:12px;color:var(--gray-500);margin-top:8px;">${formatDatetime(d.updated_at)}</div>
              ${seguimientoFinal ? `
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-100);text-align:left;">
                <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-400);margin-bottom:8px;">Entrega final</div>
                <div style="font-size:13px;color:var(--gray-600);margin-bottom:2px;">
                  📅 ${formatDate(seguimientoFinal.fecha_entrega)}${seguimientoFinal.hora_entrega ? ' · ' + seguimientoFinal.hora_entrega : ''}
                </div>
                ${seguimientoFinal.nombre_recibio ? `<div style="font-size:13px;color:var(--gray-600);margin-bottom:8px;">👤 ${seguimientoFinal.nombre_recibio}</div>` : ''}
                ${seguimientoFinal.archivo_acuse
                  ? `<a href="/api/dil${seguimientoFinal.archivo_acuse}" target="_blank" class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-top:4px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Ver Acuse de Entrega
                    </a>`
                  : '<div style="font-size:12px;color:var(--gray-400);margin-top:4px;">Sin acuse adjunto</div>'}
              </div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function cambiarEstado(id, estado, tieneFinal) {
  if (!estado) return;
  if (estado === 'entregado' && !tieneFinal) {
    document.getElementById('cambio-estado').value = '';
    toast('Completa el formulario de entrega final para marcar como Entregado', 'warning');
    openSeguimientoModal(id, true);
    return;
  }
  try {
    await API.patch(`/diligencias/${id}/estado`, { estado });
    toast('Estado actualizado', 'success');
    renderDetalle(id);
  } catch(e) {
    toast(e.message, 'error');
  }
}

function openSeguimientoModal(id, preCheckFinal = false) {
  const today = new Date().toISOString().split('T')[0];
  openModal('Registrar Tramo de Seguimiento', `
    <form id="form-seguimiento">
      <div class="form-grid">
        <div class="field-group">
          <label>Fecha <span class="req">*</span></label>
          <input type="date" name="fecha_entrega" value="${today}" required>
        </div>
        <div class="field-group">
          <label>Hora</label>
          <input type="time" name="hora_entrega">
        </div>
        <div class="field-group full-width">
          <label id="lbl-lugar">Punto de Control / Tramo</label>
          <input type="text" name="lugar" placeholder="Ej. Oficialía de Partes, Edificio Central...">
        </div>
        <div class="field-group full-width">
          <label id="lbl-recibio">Responsable en este Tramo <span class="req">*</span></label>
          <input type="text" name="nombre_recibio" placeholder="Nombre completo" required>
        </div>
        <div class="field-group full-width">
          <label>Observaciones</label>
          <textarea name="observaciones" placeholder="Notas sobre este tramo..."></textarea>
        </div>
        <div class="field-group full-width">
          <label>Constancia / Acuse (PDF)</label>
          <div class="file-upload-area" onclick="document.getElementById('acuse-file').click()" id="upload-area">
            <div class="upload-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="upload-text">Clic para subir PDF</div>
            <div class="upload-hint">Máximo 10 MB · Solo PDF</div>
          </div>
          <input type="file" id="acuse-file" accept=".pdf" style="display:none" onchange="fileSelected(this)">
        </div>
        ${['admin','coordinador','notificador'].includes(currentUser?.rol) ? `
        <div class="field-group full-width" style="background:var(--green-light);border-radius:var(--radius-sm);padding:12px;border:1px solid rgba(5,150,105,.25);">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;color:var(--success);">
            <input type="checkbox" id="es-entrega-final" onchange="toggleEntregaFinal(this)" style="width:16px;height:16px;cursor:pointer;">
            ✅ Marcar como entrega final al destinatario
          </label>
          <div style="font-size:12px;color:var(--gray-500);margin-top:4px;margin-left:26px;">Al activar esta opción, el estado cambiará a "Entregado"</div>
        </div>` : '<input type="hidden" id="es-entrega-final-hidden">'}
      </div>
      <div id="seg-error" class="alert alert-error" style="display:none;margin-top:16px;"></div>
      <div class="btn-group" style="margin-top:20px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" id="btn-guardar-seg" class="btn btn-primary">📦 Registrar Tramo</button>
      </div>
    </form>
  `);

  if (preCheckFinal) {
    const cb = document.getElementById('es-entrega-final');
    if (cb) { cb.checked = true; toggleEntregaFinal(cb); }
  }

  document.getElementById('form-seguimiento').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('seg-error');
    errEl.style.display = 'none';
    const fd = new FormData(e.target);
    const esFinal = document.getElementById('es-entrega-final')?.checked || false;
    if (esFinal && !fd.get('hora_entrega')) {
      errEl.textContent = 'La hora de entrega es obligatoria para la entrega final';
      errEl.style.display = 'block';
      return;
    }
    fd.append('tipo', esFinal ? 'final' : 'parcial');
    const fileInput = document.getElementById('acuse-file');
    if (fileInput.files[0]) fd.append('archivo_acuse', fileInput.files[0]);
    try {
      await API.postForm(`/diligencias/${id}/seguimiento`, fd);
      closeModal();
      toast(esFinal ? '✅ Entrega final registrada' : '📦 Tramo registrado correctamente', 'success');
      renderDetalle(id);
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

function toggleEntregaFinal(cb) {
  const btn = document.getElementById('btn-guardar-seg');
  const lblLugar = document.getElementById('lbl-lugar');
  const lblRecibio = document.getElementById('lbl-recibio');
  if (cb.checked) {
    btn.textContent = '✓ Confirmar Entrega Final';
    btn.className = 'btn btn-success';
    lblLugar.textContent = 'Ubicación / Domicilio de Entrega';
    lblRecibio.innerHTML = 'Nombre de quien Recibió <span class="req">*</span>';
  } else {
    btn.textContent = '📦 Registrar Tramo';
    btn.className = 'btn btn-primary';
    lblLugar.textContent = 'Punto de Control / Tramo';
    lblRecibio.innerHTML = 'Responsable en este Tramo <span class="req">*</span>';
  }
}

function fileSelected(input) {
  const area = document.getElementById('upload-area');
  if (input.files[0]) {
    area.classList.add('has-file');
    area.querySelector('.upload-text').textContent = `✓ ${input.files[0].name}`;
  }
}

function tramoHtml(s) {
  const esParcial = s.tipo === 'parcial';
  const dotBg   = esParcial ? 'var(--info)' : 'var(--success)';
  const dotIcon  = esParcial ? '🚚' : '✓';
  const titulo   = esParcial
    ? `Tramo registrado el ${formatDate(s.fecha_entrega)}${s.hora_entrega ? ' a las ' + s.hora_entrega : ''}`
    : `Entrega final el ${formatDate(s.fecha_entrega)}${s.hora_entrega ? ' a las ' + s.hora_entrega : ''}`;
  return `
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${dotBg};">${dotIcon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${titulo}</div>
        ${s.lugar ? `<div style="font-size:12px;color:var(--info);font-weight:600;margin-top:2px;">📍 ${s.lugar}</div>` : ''}
        <div class="timeline-meta">
          ${s.nombre_recibio ? `${esParcial ? 'Responsable' : 'Recibió'}: <strong>${s.nombre_recibio}</strong> · ` : ''}
          Por: ${s.registrado_por_nombre || '—'}
        </div>
        ${s.observaciones ? `<div style="font-size:13px;color:var(--gray-600);margin-top:4px;">${s.observaciones}</div>` : ''}
        ${s.archivo_acuse ? `<a href="/api/dil${s.archivo_acuse}" target="_blank" class="btn btn-outline btn-sm" style="margin-top:8px;">📄 Ver Acuse PDF</a>` : ''}
      </div>
    </div>`;
}

function buildHistorial(seguimiento) {
  if (seguimiento.length === 0) {
    return `<div class="empty-state" style="padding:30px;"><p>Sin tramos de seguimiento registrados aún</p></div>`;
  }
  const ultimo     = seguimiento[seguimiento.length - 1];
  const anteriores = seguimiento.slice(0, -1);
  const n          = anteriores.length;
  return `
    <div class="timeline">
      ${n > 0 ? `
        <div id="tramos-anteriores" style="display:none;">
          ${anteriores.map(tramoHtml).join('')}
        </div>
        <div style="margin-bottom:14px;">
          <button class="btn btn-outline btn-sm" onclick="toggleTramosAnteriores(this)">
            📋 Ver ${n} tramo${n !== 1 ? 's' : ''} anterior${n !== 1 ? 'es' : ''}
          </button>
        </div>
      ` : ''}
      ${tramoHtml(ultimo)}
    </div>`;
}

function docIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>';
  if (ext === 'zip') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}
function dzSizeDetalle(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function toggleTramosAnteriores(btn) {
  const container = document.getElementById('tramos-anteriores');
  if (!container) return;
  const visible = container.style.display !== 'none';
  container.style.display = visible ? 'none' : 'block';
  const n = container.querySelectorAll('.timeline-item').length;
  btn.textContent = visible
    ? `📋 Ver ${n} tramo${n !== 1 ? 's' : ''} anterior${n !== 1 ? 'es' : ''}`
    : `🔼 Ocultar tramos anteriores`;
}

async function openEditarModal(id) {
  let d;
  try { d = await API.get(`/diligencias/${id}`); } catch(e) { toast(e.message, 'error'); return; }

  const areasOptions = AREAS.map(a => `<option value="${a}" ${d.area_requirente===a?'selected':''}>${a}</option>`).join('');

  // Track files to delete and new files to add
  let editDocsToDelete = new Set();
  let editNewFiles = [];

  openModal('Editar Notificación', `
    <form id="form-editar" style="max-height:70vh;overflow-y:auto;padding-right:4px;">
      <div class="form-grid">
        <div class="field-group">
          <label>Área Requirente <span class="req">*</span></label>
          ${currentUser?.rol === 'usuario'
            ? `<input type="text" name="area_requirente" value="${d.area_requirente || ''}" readonly style="background:var(--gray-50);cursor:default;" required>`
            : `<select name="area_requirente" required><option value="">— Seleccionar —</option>${areasOptions}</select>`}
        </div>
        <div class="field-group">
          <label>Número de Oficio <span class="req">*</span></label>
          <input type="text" name="numero_oficio" value="${d.numero_oficio || ''}" required>
        </div>
        <div class="field-group">
          <label>ID SAI</label>
          <input type="text" name="id_sai" value="${d.id_sai || ''}" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        </div>
        <div class="field-group full-width">
          <label>Autoridad / Institución <span class="req">*</span></label>
          <input type="text" name="autoridad_nombre" value="${d.autoridad_nombre || ''}" required>
        </div>
        <div class="field-group full-width">
          <label>Calle y Número <span class="req">*</span></label>
          <input type="text" name="autoridad_domicilio" value="${d.autoridad_domicilio || ''}" required>
        </div>
        <div class="field-group">
          <label>Colonia</label>
          <input type="text" name="autoridad_colonia" value="${d.autoridad_colonia || ''}">
        </div>
        <div class="field-group">
          <label>Municipio / Alcaldía</label>
          <input type="text" name="autoridad_municipio" value="${d.autoridad_municipio || ''}">
        </div>
        <div class="field-group">
          <label>Estado</label>
          <select name="autoridad_estado">
            <option value="">— Seleccionar estado —</option>
            ${ESTADOS_MX.map(e => `<option value="${e}" ${d.autoridad_estado===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label>Código Postal</label>
          <input type="text" name="autoridad_cp" value="${d.autoridad_cp || ''}" inputmode="numeric" maxlength="5" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        </div>
        <div class="field-group full-width">
          <label>Referencias</label>
          <textarea name="autoridad_referencia">${d.autoridad_referencia || ''}</textarea>
        </div>
        <div class="field-group">
          <label>Contacto</label>
          <input type="text" name="contacto_nombre" value="${d.contacto_nombre || ''}" placeholder="Nombre">
        </div>
        <div class="field-group">
          <label>Email</label>
          <input type="email" name="contacto_email" value="${d.contacto_email || ''}">
        </div>
        <div class="field-group">
          <label>Teléfono</label>
          <input type="tel" name="contacto_telefono" value="${d.contacto_telefono || ''}">
        </div>

        <div class="section-divider full-width"><h4>Término Legal</h4></div>

        <div class="toggle-row full-width">
          <label for="edit-toggle-termino">¿Cuenta con Término Legal?</label>
          <label class="toggle">
            <input type="checkbox" id="edit-toggle-termino" name="tiene_termino_legal" ${d.tiene_termino_legal ? 'checked' : ''} onchange="editToggleTermino(this)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="edit-termino-fields" style="display:${d.tiene_termino_legal ? 'contents' : 'none'}; grid-column:1/-1;">
          <div class="form-grid" style="border:1.5px solid var(--orange);border-radius:var(--radius-sm);padding:16px;background:#fff8f0;">
            <div class="field-group">
              <label>Fecha límite</label>
              <input type="date" name="termino_fecha" value="${d.termino_fecha || ''}">
            </div>
            <div class="field-group">
              <label>Hora límite</label>
              <input type="time" name="termino_hora" value="${d.termino_hora || ''}">
            </div>
            <div class="field-group full-width">
              <label>Observaciones</label>
              <textarea name="termino_observaciones">${d.termino_observaciones || ''}</textarea>
            </div>
          </div>
        </div>

        <div class="section-divider full-width"><h4>Instrucciones para el Notificador</h4></div>
        <div class="field-group full-width">
          <label>Instrucciones adicionales</label>
          <textarea name="instrucciones_adicionales" placeholder="Indicaciones especiales, horarios de atención, persona a quien dirigirse, etc." style="min-height:80px;">${d.instrucciones_adicionales || ''}</textarea>
        </div>

        <div class="section-divider full-width"><h4>Número de tantos a imprimir</h4></div>
        <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px;padding:4px 0;">

          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="edit-cb-tantos-original" ${(d.tantos_original > 0) ? 'checked' : ''} onchange="editToggleTanto('original')">
            <label for="edit-cb-tantos-original" style="font-size:13px;cursor:pointer;min-width:180px;text-transform:none;letter-spacing:normal;font-weight:normal;">Original</label>
            <input type="number" id="edit-input-tantos-original" min="1" max="99" value="${d.tantos_original || 1}"
              style="display:${(d.tantos_original > 0) ? 'inline-block' : 'none'};width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="edit-cb-tantos-acuse" ${(d.tantos_acuse > 0) ? 'checked' : ''} onchange="editToggleTanto('acuse')">
            <label for="edit-cb-tantos-acuse" style="font-size:13px;cursor:pointer;min-width:180px;text-transform:none;letter-spacing:normal;font-weight:normal;">Acuse</label>
            <input type="number" id="edit-input-tantos-acuse" min="1" max="99" value="${d.tantos_acuse || 1}"
              style="display:${(d.tantos_acuse > 0) ? 'inline-block' : 'none'};width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="edit-cb-tantos-copias" ${(d.tantos_copias_conocimiento > 0) ? 'checked' : ''} onchange="editToggleTanto('copias')">
            <label for="edit-cb-tantos-copias" style="font-size:13px;cursor:pointer;min-width:180px;text-transform:none;letter-spacing:normal;font-weight:normal;">Copias conocimiento</label>
            <input type="number" id="edit-input-tantos-copias" min="1" max="99" value="${d.tantos_copias_conocimiento || 1}"
              style="display:${(d.tantos_copias_conocimiento > 0) ? 'inline-block' : 'none'};width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="edit-cb-tantos-traslados" ${(d.tantos_traslados > 0) ? 'checked' : ''} onchange="editToggleTanto('traslados')">
            <label for="edit-cb-tantos-traslados" style="font-size:13px;cursor:pointer;min-width:180px;text-transform:none;letter-spacing:normal;font-weight:normal;">Traslados</label>
            <input type="number" id="edit-input-tantos-traslados" min="1" max="99" value="${d.tantos_traslados || 1}"
              style="display:${(d.tantos_traslados > 0) ? 'inline-block' : 'none'};width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
          </div>

        </div>

        <div class="section-divider full-width"><h4>Archivos Adjuntos</h4></div>

        <div class="field-group full-width">
          <div id="edit-doc-list" class="dz-file-list"></div>
          <div class="dropzone" id="edit-dropzone" style="margin-top:10px;"
            ondragover="dzEditDragOver(event)" ondragleave="dzEditDragLeave(event)"
            ondrop="dzEditDrop(event)"
            onclick="document.getElementById('edit-dz-input').click()">
            <div class="dropzone-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
            </div>
            <p class="dropzone-text">Arrastra archivos o</p>
            <button type="button" class="btn-explore" onclick="event.stopPropagation();document.getElementById('edit-dz-input').click()">Explora tus archivos</button>
            <p class="dropzone-hint">Máximo 20MB · PDF, DOC, DOCX, ZIP</p>
          </div>
          <input type="file" id="edit-dz-input" accept=".pdf,.doc,.docx,.zip" multiple style="display:none"
            onchange="dzEditSelect(this.files); this.value=''">
          <div id="edit-new-file-list" class="dz-file-list" style="margin-top:6px;"></div>
        </div>
      </div>

      <div id="edit-error" class="alert alert-error" style="display:none;margin-top:16px;"></div>
      <div class="btn-group" style="margin-top:20px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
      </div>
    </form>
  `);

  // Render existing docs
  function renderEditDocList() {
    const el = document.getElementById('edit-doc-list');
    if (!d.documentos || d.documentos.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = d.documentos.map(doc => {
      const pending = editDocsToDelete.has(doc.id);
      return `<div class="dz-file-item" style="${pending ? 'opacity:.4;text-decoration:line-through;' : ''}">
        <span class="dz-file-icon">${dzIcon(doc.nombre_original)}</span>
        <span class="dz-file-name" title="${doc.nombre_original}">${doc.nombre_original}</span>
        <span class="dz-file-size">${dzSize(doc.tamanio || 0)}</span>
        <button type="button" class="dz-file-remove" title="${pending ? 'Deshacer' : 'Eliminar'}"
          onclick="${pending ? `editDocRestore(${doc.id})` : `editDocDelete(${doc.id})`}">
          ${pending
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`}
        </button>
      </div>`;
    }).join('');
  }

  function renderEditNewFiles() {
    const el = document.getElementById('edit-new-file-list');
    if (!editNewFiles.length) { el.innerHTML = ''; return; }
    el.innerHTML = editNewFiles.map((f, i) => `
      <div class="dz-file-item">
        <span class="dz-file-icon">${dzIcon(f.name)}</span>
        <span class="dz-file-name">${f.name}</span>
        <span class="dz-file-size">${dzSize(f.size)}</span>
        <button type="button" class="dz-file-remove" onclick="editNewFileRemove(${i})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  }

  window.editToggleTermino = (cb) => {
    document.getElementById('edit-termino-fields').style.display = cb.checked ? 'contents' : 'none';
  };

  window.editToggleTanto = (suffix) => {
    const cb    = document.getElementById(`edit-cb-tantos-${suffix}`);
    const input = document.getElementById(`edit-input-tantos-${suffix}`);
    input.style.display = cb.checked ? 'inline-block' : 'none';
    if (!cb.checked) input.value = '1';
  };

  window.editDocDelete  = (docId) => { editDocsToDelete.add(docId); renderEditDocList(); };
  window.editDocRestore = (docId) => { editDocsToDelete.delete(docId); renderEditDocList(); };
  window.editNewFileRemove = (i) => { editNewFiles.splice(i, 1); renderEditNewFiles(); };
  window.dzEditDragOver  = (e) => { e.preventDefault(); document.getElementById('edit-dropzone').classList.add('dz-active'); };
  window.dzEditDragLeave = () => { document.getElementById('edit-dropzone').classList.remove('dz-active'); };
  window.dzEditDrop = (e) => { e.preventDefault(); document.getElementById('edit-dropzone').classList.remove('dz-active'); dzEditAddFiles(e.dataTransfer.files); };
  window.dzEditSelect = (files) => dzEditAddFiles(files);

  function dzEditAddFiles(fileList) {
    Array.from(fileList).forEach(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) { toast(`Formato no permitido: ${f.name}`, 'error'); return; }
      if (f.size > 20 * 1024 * 1024) { toast(`${f.name} excede 20 MB`, 'error'); return; }
      if (editNewFiles.some(x => x.name === f.name && x.size === f.size)) return;
      editNewFiles.push(f);
    });
    renderEditNewFiles();
  }

  renderEditDocList();

  document.getElementById('form-editar').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const errEl = document.getElementById('edit-error');
    errEl.style.display = 'none';

    const fd = new FormData(e.target);
    const payload = {};
    for (const [k, v] of fd.entries()) payload[k] = v;

    // Tantos — leer explícitamente para no depender de inputs ocultos
    const toInt = (id) => { const n = parseInt(document.getElementById(id)?.value, 10); return isNaN(n) || n < 0 ? 1 : n; };
    payload.tantos_original            = document.getElementById('edit-cb-tantos-original').checked  ? toInt('edit-input-tantos-original')  : 0;
    payload.tantos_acuse               = document.getElementById('edit-cb-tantos-acuse').checked      ? toInt('edit-input-tantos-acuse')      : 0;
    payload.tantos_copias_conocimiento = document.getElementById('edit-cb-tantos-copias').checked     ? toInt('edit-input-tantos-copias')     : 0;
    payload.tantos_traslados           = document.getElementById('edit-cb-tantos-traslados').checked  ? toInt('edit-input-tantos-traslados')  : 0;

    try {
      // 1. Save field changes
      await API.put(`/diligencias/${id}`, payload);

      // 2. Delete marked documents
      for (const docId of editDocsToDelete) {
        await API.delete(`/diligencias/${id}/documentos/${docId}`);
      }

      // 3. Upload new files
      if (editNewFiles.length > 0) {
        const fileForm = new FormData();
        editNewFiles.forEach(f => fileForm.append('documentos', f));
        await API.postForm(`/diligencias/${id}/documentos`, fileForm);
      }

      closeModal();
      toast('Diligencia actualizada', 'success');
      renderDetalle(id);
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
    }
  };
}
