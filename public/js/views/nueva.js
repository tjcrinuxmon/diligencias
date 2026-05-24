let dropzoneFiles = [];

function renderNueva() {
  dropzoneFiles = [];
  const el = document.getElementById('view-nueva');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Nueva Diligencia</div>
        <div class="page-subtitle">Registrar solicitud de notificación</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <form id="form-nueva">
          <div class="form-grid">

            <div class="section-divider">
              <h4>Información General</h4>
            </div>

            <div class="field-group">
              <label>Área Requirente <span class="req">*</span></label>
              <select name="area_requirente" required>
                <option value="">— Seleccionar área —</option>
                ${AREAS.map(a => `<option value="${a}">${a}</option>`).join('')}
              </select>
            </div>

            <div class="toggle-row">
              <label for="toggle-anexos">¿Incluye Anexos?</label>
              <label class="toggle">
                <input type="checkbox" id="toggle-anexos" name="tiene_anexos">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="section-divider">
              <h4>Datos del Documento</h4>
            </div>

            <div class="field-group">
              <label>Número de Oficio <span class="req">*</span></label>
              <input type="text" name="numero_oficio" placeholder="Ej. OFICIO-2024-001" required>
            </div>

            <div class="field-group">
              <label>ID SAI</label>
              <input type="number" name="id_sai" placeholder="Número de expediente SAI"
                min="0" step="1" inputmode="numeric"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            </div>

            <div class="section-divider">
              <h4>Autoridad a Notificar</h4>
            </div>

            <div class="field-group full-width">
              <label>Nombre de la Autoridad / Institución <span class="req">*</span></label>
              <input type="text" name="autoridad_nombre" placeholder="Ej. Juzgado Séptimo de Distrito" required>
            </div>

            <div class="field-group full-width">
              <label>Calle y Número <span class="req">*</span></label>
              <input type="text" name="autoridad_domicilio" placeholder="Ej. Av. Juárez #100" required>
            </div>

            <div class="field-group">
              <label>Colonia</label>
              <input type="text" name="autoridad_colonia" placeholder="Colonia">
            </div>

            <div class="field-group">
              <label>Municipio / Alcaldía</label>
              <input type="text" name="autoridad_municipio" placeholder="Municipio o Alcaldía">
            </div>

            <div class="field-group">
              <label>Estado</label>
              <select name="autoridad_estado">
                <option value="">— Seleccionar estado —</option>
                ${ESTADOS_MX.map(e => `<option value="${e}">${e}</option>`).join('')}
              </select>
            </div>

            <div class="field-group">
              <label>Código Postal</label>
              <input type="text" name="autoridad_cp" placeholder="C.P.">
            </div>

            <div class="field-group full-width">
              <label>Referencias / Indicaciones de Ubicación</label>
              <textarea name="autoridad_referencia" placeholder="Referencias para encontrar el domicilio..."></textarea>
            </div>

            <div class="section-divider">
              <h4>Término Legal</h4>
            </div>

            <div class="toggle-row">
              <label for="toggle-termino">¿Cuenta con Término Legal?</label>
              <label class="toggle">
                <input type="checkbox" id="toggle-termino" name="tiene_termino_legal" onchange="toggleTermino(this)">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div id="termino-fields" style="display:none; grid-column:1/-1;">
              <div class="form-grid" style="border:1.5px solid var(--orange); border-radius:var(--radius-sm); padding:16px; background:#fff8f0;">
                <div class="alert alert-warning full-width" style="font-size:12px;">
                  ⚠️ Esta diligencia tiene término legal. El sistema generará alertas automáticas.
                </div>
                <div class="field-group">
                  <label>Fecha límite del término</label>
                  <input type="date" name="termino_fecha">
                </div>
                <div class="field-group">
                  <label>Hora límite</label>
                  <input type="time" name="termino_hora">
                </div>
                <div class="field-group full-width">
                  <label>Observaciones del término</label>
                  <textarea name="termino_observaciones" placeholder="Detalles sobre el término legal..."></textarea>
                </div>
              </div>
            </div>

            <div class="section-divider">
              <h4>Datos de Contacto del Solicitante</h4>
            </div>

            <div class="field-group">
              <label>Nombre del Contacto</label>
              <input type="text" name="contacto_nombre" placeholder="Nombre completo">
            </div>

            <div class="field-group">
              <label>Correo Electrónico</label>
              <input type="email" name="contacto_email" placeholder="correo@dominio.gob.mx">
            </div>

            <div class="field-group">
              <label>Teléfono</label>
              <input type="tel" name="contacto_telefono" placeholder="55 0000 0000">
            </div>

            <div class="section-divider">
              <h4>Archivos Adjuntos</h4>
            </div>

            <div class="field-group full-width">
              <div class="dropzone" id="dropzone"
                ondragover="dzDragOver(event)"
                ondragleave="dzDragLeave(event)"
                ondrop="dzDrop(event)"
                onclick="document.getElementById('dz-input').click()">
                <div class="dropzone-icon">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                    <path d="M12 12v9"/>
                    <path d="m16 16-4-4-4 4"/>
                  </svg>
                </div>
                <p class="dropzone-text">Arrastra aquí los archivos para subir o</p>
                <button type="button" class="btn-explore" onclick="event.stopPropagation();document.getElementById('dz-input').click()">
                  Explora tus archivos
                </button>
                <p class="dropzone-hint">Máximo 20MB · PDF, DOC, DOCX, ZIP</p>
              </div>
              <input type="file" id="dz-input" accept=".pdf,.doc,.docx,.zip"
                multiple style="display:none" onchange="dzSelect(this.files); this.value=''">
              <div id="dz-file-list" class="dz-file-list"></div>
            </div>

          </div>

          <div id="form-error" class="alert alert-error" style="display:none; margin-top:20px;"></div>

          <div class="btn-group" style="margin-top:28px; justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="navigate('lista')">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Registrar Diligencia
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('form-nueva').addEventListener('submit', submitNueva);
}

function toggleTermino(checkbox) {
  const fields = document.getElementById('termino-fields');
  fields.style.display = checkbox.checked ? 'contents' : 'none';
}

/* ── Dropzone ── */
function dzDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('dz-active');
}
function dzDragLeave(e) {
  document.getElementById('dropzone').classList.remove('dz-active');
}
function dzDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('dz-active');
  dzAddFiles(e.dataTransfer.files);
}
function dzSelect(files) {
  dzAddFiles(files);
}

const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.zip'];

function dzAddFiles(fileList) {
  Array.from(fileList).forEach(f => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      toast(`Formato no permitido: ${f.name}`, 'error');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast(`${f.name} excede el límite de 20 MB`, 'error');
      return;
    }
    if (dropzoneFiles.some(x => x.name === f.name && x.size === f.size)) return;
    dropzoneFiles.push(f);
  });
  dzRenderList();
}

function dzRemove(idx) {
  dropzoneFiles.splice(idx, 1);
  dzRenderList();
}

function dzRenderList() {
  const el = document.getElementById('dz-file-list');
  if (!dropzoneFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = dropzoneFiles.map((f, i) => `
    <div class="dz-file-item">
      <span class="dz-file-icon">${dzIcon(f.name)}</span>
      <span class="dz-file-name" title="${f.name}">${f.name}</span>
      <span class="dz-file-size">${dzSize(f.size)}</span>
      <button type="button" class="dz-file-remove" onclick="dzRemove(${i})" title="Quitar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
}

function dzIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>';
  if (ext === 'zip') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function dzSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ── Submit ── */
async function submitNueva(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-sm"></div> Guardando...';
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  const formEl = e.target;
  const fd = new FormData(formEl);

  // Build plain JSON body — checkboxes sent as booleans
  const payload = {};
  for (const [key, val] of fd.entries()) {
    if (key === 'documentos') continue; // files handled separately
    payload[key] = val;
  }
  payload.tiene_anexos       = document.getElementById('toggle-anexos').checked;
  payload.tiene_termino_legal = document.getElementById('toggle-termino').checked;

  try {
    // Step 1: create diligencia via JSON
    const result = await API.post('/diligencias', payload);

    // Step 2: upload files if any
    if (dropzoneFiles.length > 0) {
      btn.innerHTML = '<div class="spinner-sm"></div> Subiendo archivos...';
      const fileForm = new FormData();
      dropzoneFiles.forEach(f => fileForm.append('documentos', f));
      await API.postForm(`/diligencias/${result.id}/documentos`, fileForm);
    }

    dropzoneFiles = [];
    toast(`Diligencia ${result.folio} registrada exitosamente`, 'success');
    navigate('detalle', result.id);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Registrar Diligencia`;
  }
}
