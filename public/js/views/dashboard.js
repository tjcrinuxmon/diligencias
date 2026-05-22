async function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  el.innerHTML = `<div class="spinner"></div>`;
  try {
    const s = await API.get('/diligencias/stats/resumen');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle">Resumen del sistema de diligencias</div>
        </div>
        <button class="btn btn-gold" onclick="navigate('nueva')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Diligencia
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card navy">
          <div class="stat-label">Total</div>
          <div class="stat-value">${s.total}</div>
          <div class="stat-desc">diligencias registradas</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-label">Pendientes</div>
          <div class="stat-value">${s.pendiente}</div>
          <div class="stat-desc">por atender</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">En Proceso</div>
          <div class="stat-value">${s.en_proceso}</div>
          <div class="stat-desc">en gestión</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Entregadas</div>
          <div class="stat-value">${s.entregado}</div>
          <div class="stat-desc">completadas</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-label">Con Término</div>
          <div class="stat-value">${s.con_termino}</div>
          <div class="stat-desc">pendientes con plazo legal</div>
        </div>
        <div class="stat-card red">
          <div class="stat-label">Vencen Hoy</div>
          <div class="stat-value">${s.vencen_hoy}</div>
          <div class="stat-desc">⚠️ atención urgente</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        <div class="card">
          <div class="card-header"><h3>Por Área Requirente</h3></div>
          <div class="card-body" style="padding:16px;">
            ${s.por_area.length === 0 ? '<p style="color:var(--gray-500);font-size:13px;">Sin datos aún</p>' :
              s.por_area.map(a => `
                <div style="margin-bottom:12px;">
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                    <span style="color:var(--gray-700);font-weight:500;">${a.area_requirente.replace('Dirección de ', '')}</span>
                    <strong>${a.total}</strong>
                  </div>
                  <div style="background:var(--gray-100);border-radius:4px;height:6px;">
                    <div style="background:var(--navy);height:100%;border-radius:4px;width:${Math.round(a.total/s.total*100)}%"></div>
                  </div>
                </div>`).join('')
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Accesos Rápidos</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-outline" style="justify-content:flex-start;gap:10px;" onclick="navigate('nueva')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Nueva diligencia
            </button>
            <button class="btn btn-outline" style="justify-content:flex-start;gap:10px;" onclick="navigate('lista'); setTimeout(()=>{ const s=document.querySelector('#filter-estado'); if(s){s.value='pendiente'; filterDiligencias();}},300)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Ver pendientes
            </button>
            <button class="btn btn-outline" style="justify-content:flex-start;gap:10px;" onclick="navigate('calendario')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Ver calendario
            </button>
            <button class="btn btn-outline" style="justify-content:flex-start;gap:10px;" onclick="navigate('lista'); setTimeout(()=>{ const s=document.querySelector('#filter-estado'); if(s){s.value='en_proceso'; filterDiligencias();}},300)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Ver en proceso
            </button>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}
