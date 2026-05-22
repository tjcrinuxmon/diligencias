let listaPage = 1;
let listaFilters = {};

async function renderLista() {
  const el = document.getElementById('view-lista');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Diligencias</div>
        <div class="page-subtitle">Gestión y seguimiento de notificaciones</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="btn btn-outline" onclick="exportarPDF()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          Exportar PDF
        </button>
        <button class="btn btn-gold" onclick="navigate('nueva')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva
        </button>
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
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tabla-body">
            <tr><td colspan="8"><div class="spinner"></div></td></tr>
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
          <td><span style="font-size:12px;color:var(--gray-500);">${formatDate(d.created_at)}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); navigate('detalle', ${d.id})">Ver</button>
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
