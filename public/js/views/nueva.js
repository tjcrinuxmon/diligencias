let dropzoneFiles = [];

function renderNueva() {
  dropzoneFiles = [];
  const el = document.getElementById('view-nueva');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Nueva Notificación</div>
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
              ${currentUser?.rol === 'usuario' && currentUser.area
                ? `<input type="text" name="area_requirente" value="${currentUser.area}" readonly style="background:var(--gray-50);cursor:default;" required>`
                : `<select name="area_requirente" required>
                <option value="">— Seleccionar área —</option>
                ${AREAS.map(a => `<option value="${a}" ${a === currentUser?.area ? 'selected' : ''}>${a}</option>`).join('')}
              </select>`}
            </div>

            <div class="toggle-row">
              <label for="toggle-anexos">Actividades a realizar en la notificación</label>
              <label class="toggle">
                <input type="checkbox" id="toggle-anexos" name="tiene_anexos" onchange="toggleAnexos(this)">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div id="anexos-fields" style="display:none; grid-column:1/-1;">
              <div style="border:1.5px solid var(--blue-light,#bfdbfe);border-radius:6px;padding:14px 18px;background:#f0f9ff;display:flex;flex-direction:column;gap:8px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:.5px;">Actividades a realizar</p>

                <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-firma-deaj" name="anexo_firma_deaj" style="margin-top:2px;flex-shrink:0;">
                  <span><u><strong>Recabar firma autógrafa del DEAJ</strong></u> (hoja verde)</span>
                </label>

                <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-imprimir" name="anexo_imprimir" style="margin-top:2px;flex-shrink:0;">
                  <span><strong>Imprimir anexo</strong></span>
                </label>

<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-digitalizar" name="anexo_digitalizar" style="margin-top:2px;flex-shrink:0;">
                  <span>Digitalizar</span>
                </label>

                <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-quemar-cd" name="anexo_quemar_cd" style="margin-top:2px;flex-shrink:0;">
                  <span>Quemar CD</span>
                </label>

                <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-usb" name="anexo_usb" style="margin-top:2px;flex-shrink:0;">
                  <span>USB</span>
                </label>

                <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
                  <span>Guardar en sobre cerrado:</span>
                  <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                    <input type="radio" name="anexo_sobre_cerrado" value="SI"> SI
                  </label>
                  <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                    <input type="radio" name="anexo_sobre_cerrado" value="NO"> NO
                  </label>
                </div>

                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cb-otro" onchange="toggleAnexoOtro(this)" style="flex-shrink:0;">
                  <span>Otro:</span>
                  <input type="text" id="input-otro" name="anexo_otro" placeholder="Especificar…"
                    style="display:none;flex:1;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;">
                </label>
              </div>
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
              <input type="text" name="id_sai" placeholder="Número de expediente SAI"
                inputmode="numeric" maxlength="10"
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
              <input type="text" name="autoridad_cp" placeholder="C.P."
                inputmode="numeric" maxlength="5"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')">
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
              <h4>Instrucciones Adicionales</h4>
            </div>

            <div class="field-group full-width">
              <label>Instrucciones para el notificador</label>
              <textarea name="instrucciones_adicionales" placeholder="Indicaciones especiales, horarios de atención, persona a quien dirigirse, etc." style="min-height:80px;"></textarea>
            </div>

            <div class="section-divider">
              <h4>Número de tantos a imprimir</h4>
            </div>

            <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px;padding:4px 0;">

              <label style="display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;width:fit-content;">
                <input type="checkbox" id="cb-tantos-original" onchange="toggleTanto('tantos-original')">
                <span style="width:180px;">Original</span>
                <input type="number" id="input-tantos-original" name="tantos_original" min="1" max="99" value="1"
                  style="display:none;width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
              </label>

              <label style="display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;width:fit-content;">
                <input type="checkbox" id="cb-tantos-acuse" onchange="toggleTanto('tantos-acuse')">
                <span style="width:180px;">Acuse</span>
                <input type="number" id="input-tantos-acuse" name="tantos_acuse" min="1" max="99" value="1"
                  style="display:none;width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
              </label>

              <label style="display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;width:fit-content;">
                <input type="checkbox" id="cb-tantos-copias" onchange="toggleTanto('tantos-copias')">
                <span style="width:180px;">Copias conocimiento</span>
                <input type="number" id="input-tantos-copias" name="tantos_copias_conocimiento" min="1" max="99" value="1"
                  style="display:none;width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
              </label>

              <label style="display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;width:fit-content;">
                <input type="checkbox" id="cb-tantos-traslados" onchange="toggleTanto('tantos-traslados')">
                <span style="width:180px;">Traslados</span>
                <input type="number" id="input-tantos-traslados" name="tantos_traslados" min="1" max="99" value="1"
                  style="display:none;width:70px;height:28px;font-size:13px;padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
              </label>

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

function toggleAnexos(checkbox) {
  const fields = document.getElementById('anexos-fields');
  fields.style.display = checkbox.checked ? '' : 'none';
  if (!checkbox.checked) {
    ['cb-firma-deaj','cb-imprimir','cb-digitalizar','cb-quemar-cd','cb-usb','cb-otro'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    document.querySelectorAll('input[name="anexo_sobre_cerrado"]').forEach(r => r.checked = false);
    const otroInput = document.getElementById('input-otro');
    if (otroInput) { otroInput.value = ''; otroInput.style.display = 'none'; }
  }
}


function toggleTanto(key) {
  const cb = document.getElementById(`cb-${key}`);
  const input = document.getElementById(`input-${key}`);
  input.style.display = cb.checked ? 'inline-block' : 'none';
  if (!cb.checked) input.value = '1';
}

function toggleAnexoOtro(checkbox) {
  const input = document.getElementById('input-otro');
  input.style.display = checkbox.checked ? 'inline-block' : 'none';
  if (!checkbox.checked) input.value = '';
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
  payload.tiene_anexos        = document.getElementById('toggle-anexos').checked;
  payload.tiene_termino_legal = document.getElementById('toggle-termino').checked;
  if (payload.tiene_anexos) {
    payload.anexo_firma_deaj  = document.getElementById('cb-firma-deaj').checked;
    payload.anexo_imprimir    = document.getElementById('cb-imprimir').checked;
payload.anexo_digitalizar = document.getElementById('cb-digitalizar').checked;
    payload.anexo_quemar_cd   = document.getElementById('cb-quemar-cd').checked;
    payload.anexo_usb         = document.getElementById('cb-usb').checked;
    // tantos a imprimir
    payload.tantos_original             = document.getElementById('cb-tantos-original').checked   ? parseInt(document.getElementById('input-tantos-original').value)   || 0 : 0;
    payload.tantos_acuse                = document.getElementById('cb-tantos-acuse').checked       ? parseInt(document.getElementById('input-tantos-acuse').value)       || 0 : 0;
    payload.tantos_copias_conocimiento  = document.getElementById('cb-tantos-copias').checked      ? parseInt(document.getElementById('input-tantos-copias').value)      || 0 : 0;
    payload.tantos_traslados            = document.getElementById('cb-tantos-traslados').checked   ? parseInt(document.getElementById('input-tantos-traslados').value)   || 0 : 0;

    const sobreEl = document.querySelector('input[name="anexo_sobre_cerrado"]:checked');
    payload.anexo_sobre_cerrado = sobreEl ? sobreEl.value : null;
    const otroEl = document.getElementById('input-otro');
    payload.anexo_otro = otroEl.style.display !== 'none' ? otroEl.value.trim() || null : null;
  }

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
