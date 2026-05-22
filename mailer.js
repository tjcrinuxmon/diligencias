const nodemailer = require('nodemailer');

// Configure your SMTP here or via environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'notificaciones@tudominio.gob.mx',
    pass: process.env.SMTP_PASS || 'tu_password'
  }
});

async function sendNotificacion(diligencia, seguimiento) {
  const { contacto_email, contacto_nombre, folio, numero_oficio, area_requirente, autoridad_nombre } = diligencia;
  const { fecha_entrega, hora_entrega, nombre_recibio, observaciones } = seguimiento;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #1a3a5c; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Sistema de Diligencias</h1>
    <p style="color: #a8c4e0; margin: 5px 0 0;">Notificación de Entrega</p>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border: 1px solid #dee2e6;">
    <p>Estimado/a <strong>${contacto_nombre || 'solicitante'}</strong>,</p>
    <p>Se le informa que la diligencia con folio <strong>${folio}</strong> ha sido <strong style="color: #198754;">ENTREGADA</strong> exitosamente.</p>
    
    <table style="width:100%; border-collapse: collapse; margin: 20px 0; background:white;">
      <tr style="background:#1a3a5c; color:white;">
        <th colspan="2" style="padding:10px; text-align:left; font-size:13px;">DETALLES DE LA DILIGENCIA</th>
      </tr>
      <tr><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold; width:40%;">Folio</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${folio}</td></tr>
      <tr><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Número de Oficio</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${numero_oficio}</td></tr>
      <tr><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Área Requirente</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${area_requirente}</td></tr>
      <tr><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Autoridad Notificada</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${autoridad_nombre}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Fecha de Entrega</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${fecha_entrega}${hora_entrega ? ' a las ' + hora_entrega : ''}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Recibió</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${nombre_recibio || 'No especificado'}</td></tr>
      ${observaciones ? `<tr><td style="padding:8px 12px; border:1px solid #dee2e6; font-weight:bold;">Observaciones</td><td style="padding:8px 12px; border:1px solid #dee2e6;">${observaciones}</td></tr>` : ''}
    </table>
    
    <p style="color:#666; font-size:12px; margin-top:20px;">Este es un mensaje automático del Sistema de Diligencias. No responda a este correo.</p>
  </div>
  <div style="background:#1a3a5c; padding: 10px; text-align:center;">
    <p style="color: #a8c4e0; margin: 0; font-size: 11px;">Sistema de Calendarización de Diligencias © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"Sistema Diligencias" <${process.env.SMTP_USER || 'notificaciones@tudominio.gob.mx'}>`,
    to: contacto_email,
    subject: `✅ Diligencia ${folio} entregada - Oficio ${numero_oficio}`,
    html
  });
}

module.exports = { sendNotificacion };
