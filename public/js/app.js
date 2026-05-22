let currentUser = null;
let currentView = 'dashboard';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Iniciando sesión...';
    try {
      const user = await API.post('/auth/login', { email, password });
      currentUser = user;
      showApp(user);
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Iniciar Sesión';
    }
  });

  // Check existing session
  try {
    const user = await API.get('/auth/me');
    currentUser = user;
    showApp(user);
  } catch {
    // Not logged in, show login
  }
});

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';

  // Set user info in sidebar
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-role').textContent = { admin: 'Administrador', usuario: 'Usuario', notificador: 'Notificador' }[user.rol] || user.rol;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();

  // Admin nav
  if (user.rol === 'admin') {
    document.getElementById('admin-nav').style.display = 'block';
    document.getElementById('nav-usuarios').style.display = 'flex';
  }

  // Logout
  document.getElementById('btn-logout').onclick = async () => {
    await API.post('/auth/logout', {});
    currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
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
