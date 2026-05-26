let listaPage = 1;
let listaFilters = {};

async function renderLista() {
  const el = document.getElementById('view-lista');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Notificaciones</div>
        <div class="page-subtitle">Gestión y seguimiento de notificaciones</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="btn btn-outline" onclick="exportarPDF()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          Exportar PDF
        </button>
        ${currentUser && currentUser.rol !== 'notificador' ? `
        <button class="btn btn-gold" onclick="navigate('nueva')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva
        </button>` : ''}
      </div>
    </div>

    <div class="filters-bar">
      <input type="text" id="filter-buscar" class="filter-search" placeholder="🔍 Buscar por folio, oficio, autoridad, SAI...">
      <select id="filter-estado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="en_proceso">En Proceso</option>
        <option value="entregado">Entregado</option>
        <option value="no_entregado">No Entregado</option>
        <option value="cancelado">Cancelado</option>
      </select>
      <select id="filter-area">
        <option value="">Todas las áreas</option>
        ${AREAS.map(a => `<option value="${a}">${a.replace('Dirección de ', '')}</option>`).join('')}
      </select>
      <input type="date" id="filter-desde" title="Desde">
      <input type="date" id="filter-hasta" title="Hasta">
      <button class="btn btn-outline btn-sm" onclick="clearFilters()">Limpiar</button>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Área Requirente</th>
              <th>Oficio / SAI</th>
              <th>Autoridad</th>
              <th>Término</th>
              <th>Estado</th>
              ${currentUser && currentUser.rol !== 'notificador' ? '<th>Asignado a</th>' : ''}
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tabla-body">
            <tr><td colspan="9"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="lista-pagination"></div>
    </div>
  `;

  // Filter events
  let searchTimer;
  document.getElementById('filter-buscar').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => filterDiligencias(), 400);
  });
  ['filter-estado','filter-area','filter-desde','filter-hasta'].forEach(id => {
    document.getElementById(id).addEventListener('change', filterDiligencias);
  });

  await loadDiligencias();
}

async function filterDiligencias() {
  listaPage = 1;
  await loadDiligencias();
}

function clearFilters() {
  ['filter-buscar','filter-estado','filter-area','filter-desde','filter-hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filterDiligencias();
}

async function loadDiligencias() {
  const params = new URLSearchParams({
    page: listaPage, limit: 20,
    buscar: document.getElementById('filter-buscar')?.value || '',
    estado: document.getElementById('filter-estado')?.value || '',
    area: document.getElementById('filter-area')?.value || '',
    desde: document.getElementById('filter-desde')?.value || '',
    hasta: document.getElementById('filter-hasta')?.value || '',
  });

  const tbody = document.getElementById('tabla-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="spinner"></div></td></tr>`;

  try {
    const { data, total, page, pages } = await API.get(`/diligencias?${params}`);
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3>Sin resultados</h3><p>No se encontraron diligencias con los filtros aplicados</p>
      </div></td></tr>`;
    } else {
      const isNotificador = currentUser && currentUser.rol === 'notificador';
      const canAssign = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'coordinador');
      const canEdit = (d) => currentUser && (currentUser.id === d.creado_por || currentUser.rol === 'admin' || currentUser.rol === 'coordinador');
      tbody.innerHTML = data.map(d => `
        <tr class="row-link" onclick="navigate('detalle', ${d.id})">
          <td><span class="folio">${d.folio}</span>${d.tiene_anexos ? '<br><span style="font-size:10px;color:var(--blue);">📎 Anexos</span>' : ''}</td>
          <td><span style="font-size:13px;">${d.area_requirente.replace('Dirección de ', 'Dir. ')}</span></td>
          <td>
            <div style="font-weight:600;font-size:13px;">${d.numero_oficio}</div>
            ${d.id_sai ? `<div class="text-muted">SAI: ${d.id_sai}</div>` : ''}
          </td>
          <td>
            <div style="font-size:13px;font-weight:500;">${d.autoridad_nombre}</div>
            <div class="text-muted">${d.autoridad_municipio || d.autoridad_estado || ''}</div>
          </td>
          <td>${terminoBadge(d)}</td>
          <td>${estadoBadge(d.estado)}</td>
          ${!isNotificador ? `<td><span style="font-size:12px;color:var(--gray-600);">${d.asignado_a_nombre || '<span style="color:var(--gray-400)">Sin asignar</span>'}</span></td>` : ''}
          <td><span style="font-size:12px;color:var(--gray-500);">${formatDate(d.created_at)}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-outline btn-sm icon-btn" title="Ver detalle" onclick="event.stopPropagation(); navigate('detalle', ${d.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${canAssign ? `
            <button class="btn btn-outline btn-sm icon-btn" title="Asignar notificador" style="margin-left:4px;" onclick="event.stopPropagation(); openAsignarModal(${d.id}, '${d.folio}', ${d.asignado_a || 'null'})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </button>` : ''}
            ${canEdit(d) ? `
            <button class="btn btn-outline btn-sm icon-btn" title="Editar" style="margin-left:4px;" onclick="event.stopPropagation(); openEditarModal(${d.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>` : ''}
            ${(currentUser && currentUser.id === d.creado_por) ? `
            <button class="btn btn-outline btn-sm icon-btn" title="Eliminar" style="margin-left:4px;color:var(--red);" onclick="event.stopPropagation(); eliminarDiligencia(${d.id}, '${d.folio}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>` : ''}
          </td>
        </tr>
      `).join('');
    }

    // Pagination
    const pag = document.getElementById('lista-pagination');
    if (pag) {
      const start = (page - 1) * 20 + 1;
      const end = Math.min(page * 20, total);
      pag.innerHTML = `
        <span>${total > 0 ? `Mostrando ${start}–${end} de ${total}` : 'Sin resultados'}</span>
        <div class="pagination-btns">
          <button onclick="changePage(${page-1})" ${page <= 1 ? 'disabled' : ''}>‹ Anterior</button>
          ${Array.from({length: Math.min(pages, 5)}, (_,i) => {
            const p = i + 1;
            return `<button class="${p===page?'active':''}" onclick="changePage(${p})">${p}</button>`;
          }).join('')}
          <button onclick="changePage(${page+1})" ${page >= pages ? 'disabled' : ''}>Siguiente ›</button>
        </div>
      `;
    }
  } catch(e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="alert alert-error">${e.message}</div></td></tr>`;
  }
}

async function changePage(p) {
  listaPage = p;
  await loadDiligencias();
  document.querySelector('.main-content').scrollTop = 0;
}

async function eliminarDiligencia(id, folio) {
  openModal('Eliminar Diligencia', `
    <div style="text-align:center;padding:16px 0;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.5" style="margin-bottom:12px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p style="font-size:15px;margin-bottom:6px;">¿Eliminar la diligencia <strong>${folio}</strong>?</p>
      <p style="font-size:13px;color:var(--gray-500);">Esta acción no se puede deshacer. Se eliminarán también los archivos adjuntos y el historial de seguimiento.</p>
    </div>
    <div class="btn-group" style="justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn" style="background:var(--red);color:#fff;" id="btn-confirmar-eliminar">Eliminar</button>
    </div>
  `);

  document.getElementById('btn-confirmar-eliminar').onclick = async () => {
    try {
      await API.delete(`/diligencias/${id}`);
      closeModal();
      toast(`Diligencia ${folio} eliminada`, 'success');
      await loadDiligencias();
    } catch(err) {
      toast(err.message, 'error');
    }
  };
}

async function exportarPDF() {
  if (!window.jspdf) { toast('Librería PDF no disponible', 'error'); return; }
  const btn = document.querySelector('[onclick="exportarPDF()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }

  try {
    const params = new URLSearchParams({
      page: 1, limit: 2000,
      buscar: document.getElementById('filter-buscar')?.value || '',
      estado: document.getElementById('filter-estado')?.value || '',
      area: document.getElementById('filter-area')?.value || '',
      desde: document.getElementById('filter-desde')?.value || '',
      hasta: document.getElementById('filter-hasta')?.value || '',
    });
    const { data } = await API.get(`/diligencias?${params}`);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();

    // Encabezado
    doc.setFillColor(88, 46, 115);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('INE — Sistema de Diligencias', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, pw - 14, 14, { align: 'right' });

    const estadoLabel = {
      pendiente: 'Pendiente', en_proceso: 'En Proceso', entregado: 'Entregado',
      no_entregado: 'No Entregado', cancelado: 'Cancelado'
    };

    doc.autoTable({
      startY: 27,
      head: [['Folio', 'Área Requirente', 'Núm. Oficio', 'ID SAI', 'Autoridad', 'Municipio/Estado', 'Término', 'Estado', 'Creado']],
      body: data.map(d => [
        d.folio,
        d.area_requirente.replace('Dirección de ', 'Dir. '),
        d.numero_oficio,
        d.id_sai || '—',
        d.autoridad_nombre,
        [d.autoridad_municipio, d.autoridad_estado].filter(Boolean).join(', ') || '—',
        d.termino_fecha ? formatDate(d.termino_fecha) : '—',
        estadoLabel[d.estado] || d.estado,
        formatDate(d.created_at),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [42, 18, 57], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 245, 251] },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 2: { cellWidth: 28 },
        3: { cellWidth: 16 }, 4: { cellWidth: 42 }, 5: { cellWidth: 28 },
        6: { cellWidth: 20 }, 7: { cellWidth: 22 }, 8: { cellWidth: 20 },
      },
      margin: { left: 10, right: 10 },
      didDrawPage: (d) => {
        const pg = doc.internal.getCurrentPageInfo().pageNumber;
        const total = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${pg} de ${total}`, pw / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
      },
    });

    doc.save(`diligencias-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast('PDF generado exitosamente', 'success');
  } catch(e) {
    toast('Error al exportar: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> Exportar PDF`;
    }
  }
}

async function openAsignarModal(diligenciaId, folio, asignadoActualId) {
  let notificadores;
  try {
    const res = await API.get('/usuarios?rol=notificador');
    notificadores = (res.data || res).filter(u => u.activo);
  } catch(e) {
    toast('Error al cargar notificadores', 'error');
    return;
  }

  const options = notificadores.map(n =>
    `<option value="${n.id}" ${n.id === asignadoActualId ? 'selected' : ''}>${n.nombre}</option>`
  ).join('');

  openModal(`Asignar Diligencia ${folio}`, `
    <form id="form-asignar">
      <div class="field-group" style="margin-bottom:16px;">
        <label>Notificador asignado</label>
        <select name="asignado_a" id="select-notificador">
          <option value="">— Sin asignar —</option>
          ${options}
        </select>
      </div>
      <div id="asignar-error" class="alert alert-error" style="display:none;margin-bottom:12px;"></div>
      <div class="btn-group" style="justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);

  document.getElementById('form-asignar').onsubmit = async (e) => {
    e.preventDefault();
    const asignado_a = document.getElementById('select-notificador').value || null;
    const errEl = document.getElementById('asignar-error');
    errEl.style.display = 'none';
    try {
      await API.patch(`/diligencias/${diligenciaId}/asignar`, { asignado_a });
      closeModal();
      toast('Asignación guardada', 'success');
      if (currentView === 'detalle') renderDetalle(diligenciaId);
      else await loadDiligencias();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}
