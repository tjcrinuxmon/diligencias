// API Client
const API = {
  _csrfToken: null,
  async fetchCsrf() {
    try {
      const r = await fetch('/api/dil/auth/csrf');
      if (r.ok) { const d = await r.json(); this._csrfToken = d.csrfToken || null; }
    } catch {}
  },
  async request(method, url, data, isFormData = false) {
    const opts = { method, headers: {} };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!this._csrfToken) await this.fetchCsrf();
      if (this._csrfToken) opts.headers['X-CSRF-Token'] = this._csrfToken;
    }
    if (data && !isFormData) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    if (data && isFormData) { opts.body = data; }
    const res = await fetch('/api/dil' + url, opts);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // El servidor devolvió algo que no es JSON (error de proxy, HTML, etc.)
      throw new Error(res.ok ? 'Respuesta inesperada del servidor' : `Error ${res.status}: ${text.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(json.error || 'Error del servidor');
    return json;
  },
  get: (url) => API.request('GET', url),
  post: (url, data) => API.request('POST', url, data),
  postForm: (url, formData) => API.request('POST', url, formData, true),
  patch: (url, data) => API.request('PATCH', url, data),
  put: (url, data) => API.request('PUT', url, data),
  delete: (url) => API.request('DELETE', url),
};

// Toast notifications
function toast(msg, type = 'success', duration = 3500) {
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || '•'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// Modal
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') closeModal(); };

// Utilities
function formatDate(d) {
  if (!d) return '—';
  const parts = d.split('T')[0].split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function formatDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
}
function terminoBadge(d) {
  if (!d.tiene_termino_legal) return '';
  if (d.estado === 'entregado') return `<span class="termino-badge termino-ok">✅ Cumplido</span>`;
  const days = daysUntil(d.termino_fecha);
  if (days === null) return '';
  if (days < 0) return `<span class="termino-badge termino-vence-hoy">⚠ Vencido</span>`;
  if (days === 0) return `<span class="termino-badge termino-vence-hoy">🔴 Vence hoy</span>`;
  if (days <= 3) return `<span class="termino-badge termino-proximo">⏰ ${days}d restantes</span>`;
  return `<span class="termino-badge termino-ok">📅 ${formatDate(d.termino_fecha)}</span>`;
}
const estadoBadge = (e) => `<span class="badge badge-${e}">${{
  pendiente:'Pendiente', en_proceso:'En Proceso', entregado:'Entregado',
  no_entregado:'No Entregado', cancelado:'Cancelado'
}[e] || e}</span>`;

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila de Zaragoza','Colima','Durango','Estado de México','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','Michoacán de Ocampo','Morelos','Nayarit','Nuevo León',
  'Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
  'Tabasco','Tamaulipas','Tlaxcala','Veracruz de Ignacio de la Llave','Yucatán','Zacatecas'
];

const AREAS = [
  'Coordinación de Análisis de Información y Control Documental',
  'Dirección de Instrucción Recursal',
  'Dirección de Servicios Legales',
  'Dirección de Asuntos Laborales',
  'Dirección de Normatividad y Consulta',
  'Dirección de Asuntos HASL',
  'Dirección de Contratos y Convenios'
];
