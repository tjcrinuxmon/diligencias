let currentUser = null;
let currentView = 'dashboard';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const ssoToken = params.get('sso_token');
  const ssoError = params.get('error');

  if (ssoToken) { window.location.href = `/api/dil/auth/sso?sso_token=${ssoToken}`; return }

  if (ssoError === 'no_access') {
    document.getElementById('auth-loading').innerHTML =
      '<p style="color:#b91c1c;font-size:14px;text-align:center;padding:20px">No tienes acceso a este módulo.<br>Contacta al administrador del sistema.</p>';
    setTimeout(() => window.location.replace('/'), 4000);
    return;
  }

  // Check existing session — if none, redirect to portal
  try {
    const user = await API.get('/auth/me');
    currentUser = user;
    showApp(user);
  } catch {
    window.location.replace('/');
  }
});

function showApp(user) {
  document.getElementById('auth-loading').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';

  // Set user info in sidebar
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-role').textContent = { admin: 'Administrador', usuario: 'Usuario', notificador: 'Notificador', coordinador: 'Coordinador' }[user.rol] || user.rol;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();

  // Admin/coordinador nav
  if (user.rol === 'admin' || user.rol === 'coordinador') {
    document.getElementById('admin-nav').style.display = 'block';
    document.getElementById('nav-usuarios').style.display = user.rol === 'admin' ? 'flex' : 'none';
  }

  // Hide "Nueva Diligencia" nav for notificadores
  if (user.rol === 'notificador') {
    const navNueva = document.querySelector('.nav-item[data-view="nueva"]');
    if (navNueva) navNueva.style.display = 'none';
  }

  // Logout → portal
  document.getElementById('btn-logout').onclick = async () => {
    try { await API.post('/auth/logout', {}); } catch {}
    window.location.replace('/');
  };

  // Nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });

  // Hamburger menu
  const hamburger = document.getElementById('nav-hamburger');
  const topnavNav = document.getElementById('topnav-nav');
  if (hamburger && topnavNav) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      topnavNav.classList.toggle('mobile-open');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topnav')) topnavNav.classList.remove('mobile-open');
    });
  }

  navigate('dashboard');
}

function navigate(view, param = null) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  currentView = view;

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.style.display = 'block';

  // Render appropriate view
  switch(view) {
    case 'dashboard': renderDashboard(); break;
    case 'nueva': renderNueva(); break;
    case 'lista': renderLista(); break;
    case 'calendario': renderCalendario(); break;
    case 'detalle': 
      document.getElementById('view-detalle').style.display = 'block';
      renderDetalle(param); 
      break;
    case 'usuarios': renderUsuarios(); break;
  }
}
