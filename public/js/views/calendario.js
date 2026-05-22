async function renderCalendario() {
  const el = document.getElementById('view-calendario');
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  async function draw() {
    el.innerHTML = `<div class="spinner"></div>`;
    try {
      // Fetch diligencias with termino legal for this month range
      const desde = new Date(year, month, 1).toISOString().split('T')[0];
      const hasta = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const { data } = await API.get(`/diligencias?limit=200&desde=${desde}&hasta=${hasta}`);

      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

      // Build events map by day
      const eventsByDay = {};
      data.forEach(d => {
        const key = d.created_at?.split('T')[0];
        if (!eventsByDay[key]) eventsByDay[key] = [];
        eventsByDay[key].push({ type: 'registro', d });

        if (d.tiene_termino_legal && d.termino_fecha) {
          if (!eventsByDay[d.termino_fecha]) eventsByDay[d.termino_fecha] = [];
          eventsByDay[d.termino_fecha].push({ type: 'termino', d });
        }
      });

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date(); today.setHours(0,0,0,0);
      const todayStr = today.toISOString().split('T')[0];

      let cells = '';
      for (let i = 0; i < firstDay; i++) cells += `<div class="cal-day other-month"></div>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isToday = dateStr === todayStr;
        const events = eventsByDay[dateStr] || [];
        const hasEvents = events.length > 0;

        cells += `
          <div class="cal-day ${isToday?'today':''} ${hasEvents?'has-events':''}" ${hasEvents?`onclick="showDayEvents('${dateStr}')"`:''}>
            <div class="cal-day-num">${day}</div>
            ${events.slice(0,3).map(ev =>
              ev.type === 'termino'
                ? `<div class="cal-event urgente" title="${ev.d.numero_oficio}">⚖ ${ev.d.numero_oficio}</div>`
                : `<div class="cal-event normal" title="${ev.d.numero_oficio}">${ev.d.numero_oficio}</div>`
            ).join('')}
            ${events.length > 3 ? `<div style="font-size:10px;color:var(--gray-500);">+${events.length-3} más</div>` : ''}
          </div>
        `;
      }

      el.innerHTML = `
        <div class="page-header">
          <div>
            <div class="page-title">Calendario</div>
            <div class="page-subtitle">Vista de términos y diligencias programadas</div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
              <button class="btn btn-outline" onclick="calPrevMonth()">‹ Anterior</button>
              <h2 style="font-family:'DM Serif Display',serif;font-size:24px;color:var(--navy);">${monthNames[month]} ${year}</h2>
              <button class="btn btn-outline" onclick="calNextMonth()">Siguiente ›</button>
            </div>

            <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;flex-wrap:wrap;">
              <span><span class="cal-event normal" style="display:inline-block;">●</span> Diligencia registrada</span>
              <span><span class="cal-event urgente" style="display:inline-block;">●</span> Término legal vence</span>
            </div>

            <div class="calendar-grid">
              ${dayNames.map(d => `<div class="cal-header">${d}</div>`).join('')}
              ${cells}
            </div>
          </div>
        </div>
      `;

      // Store for navigation
      window._calData = { year, month, eventsByDay };

    } catch(e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  window.calPrevMonth = async () => {
    month--; if (month < 0) { month = 11; year--; }
    await draw();
  };
  window.calNextMonth = async () => {
    month++; if (month > 11) { month = 0; year++; }
    await draw();
  };
  window.showDayEvents = (dateStr) => {
    const events = (window._calData?.eventsByDay[dateStr] || []);
    if (!events.length) return;
    const html = events.map(ev => `
      <div style="padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;" onclick="closeModal();navigate('detalle',${ev.d.id})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          ${ev.type === 'termino' ? '<span style="color:var(--red);font-size:12px;font-weight:700;">⚖ TÉRMINO LEGAL</span>' : '<span style="color:var(--blue);font-size:12px;font-weight:700;">📋 DILIGENCIA</span>'}
          ${estadoBadge(ev.d.estado)}
        </div>
        <div style="font-weight:600;">${ev.d.numero_oficio}</div>
        <div style="font-size:13px;color:var(--gray-500);">${ev.d.autoridad_nombre} · ${ev.d.area_requirente.replace('Dirección de ','')}</div>
        <div style="font-size:11px;color:var(--navy);margin-top:4px;">Clic para ver detalle →</div>
      </div>
    `).join('');
    openModal(`Eventos del ${dateStr}`, html);
  };

  await draw();
}
