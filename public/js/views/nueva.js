function renderNueva() {
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
              <input type="text" name="id_sai" placeholder="Número de expediente SAI">
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
              <input type="text" name="autoridad_estado" placeholder="Estado">
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

async function submitNueva(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Guardando...';
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  const data = Object.fromEntries(new FormData(e.target).entries());
  data.tiene_anexos = document.getElementById('toggle-anexos').checked;
  data.tiene_termino_legal = document.getElementById('toggle-termino').checked;

  try {
    const result = await API.post('/diligencias', data);
    toast(`Diligencia ${result.folio} registrada exitosamente`, 'success');
    navigate('detalle', result.id);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Registrar Diligencia`;
  }
}
