# Sistema de Calendarización de Diligencias
> Gestión y seguimiento de notificaciones legales

## 🚀 Instalación y Configuración

### Requisitos
- Node.js 18 o superior
- npm

### Pasos de instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu editor de preferencia

# 3. Iniciar el servidor
npm start

# Para desarrollo (con auto-restart):
npm run dev   # requiere: npm install -g nodemon
```

### Acceso inicial
- URL: http://localhost:3000
- Email: `admin@diligencias.gob.mx`
- Contraseña: `Admin1234!`
> ⚠️ Cambia la contraseña del admin inmediatamente después del primer acceso.

---

## 📧 Configuración de Correo Electrónico

Edita el archivo `.env` con los datos de tu servidor SMTP:

```env
SMTP_HOST=smtp.tudominio.gob.mx
SMTP_PORT=587
SMTP_USER=notificaciones@tudominio.gob.mx
SMTP_PASS=tu_contrasena
```

**Para Gmail:** genera una "Contraseña de aplicación" en:
Cuenta Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación

---

## 🌐 Despliegue en Servidor

### Con PM2 (recomendado para producción)
```bash
npm install -g pm2
pm2 start server.js --name "diligencias"
pm2 save
pm2 startup
```

### Con Nginx como proxy inverso
```nginx
server {
    listen 80;
    server_name tu-dominio.gob.mx;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

---

## 📁 Estructura del Proyecto

```
diligencias/
├── server.js           # Servidor principal Express
├── database.js         # Configuración SQLite y schema
├── mailer.js           # Módulo de correo electrónico
├── routes/
│   ├── auth.js         # Login / logout / sesión
│   ├── diligencias.js  # CRUD de diligencias
│   └── usuarios.js     # Gestión de usuarios
├── public/
│   ├── index.html      # SPA principal
│   ├── css/style.css   # Estilos
│   ├── js/
│   │   ├── api.js      # Cliente API y utilidades
│   │   ├── app.js      # Controlador principal
│   │   └── views/      # Vistas de la aplicación
│   └── uploads/        # Archivos PDF subidos
├── diligencias.sqlite  # Base de datos (se crea automáticamente)
└── .env                # Variables de entorno
```

---

## 👥 Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo + gestión de usuarios |
| **Usuario** | Crear y ver diligencias |
| **Notificador** | Registrar seguimiento/entrega |

---

## 🔧 Funcionalidades

- ✅ Registro de diligencias con folio automático
- ✅ Seguimiento por estados (Pendiente → En Proceso → Entregado)
- ✅ Alertas visuales para términos legales
- ✅ Subida de acuse de recibo en PDF
- ✅ Notificaciones por correo electrónico automáticas
- ✅ Calendario con vista de términos y diligencias
- ✅ Dashboard con estadísticas y gráficas por área
- ✅ Búsqueda y filtrado avanzado
- ✅ Gestión de usuarios con roles
- ✅ Link a Google Maps para el domicilio de notificación
