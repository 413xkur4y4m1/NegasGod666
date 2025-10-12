import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const notificationTemplates = {
  materialAdded: (materialName: string, quantity: number) => ({
    subject: `Nuevo Material Agregado: ${materialName}`,
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Nuevo Material Agregado al Inventario</h2>
        <p>Se ha agregado el siguiente material al sistema:</p>
        <ul>
          <li><strong>Material:</strong> ${materialName}</li>
          <li><strong>Cantidad:</strong> ${quantity}</li>
        </ul>
        <p>Este es un mensaje automático del sistema de inventario.</p>
      </div>
    `
  }),

  materialUpdated: (materialName: string, changes: Record<string, any>) => ({
    subject: `Material Actualizado: ${materialName}`,
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Actualización de Material en Inventario</h2>
        <p>Se ha actualizado el siguiente material:</p>
        <ul>
          <li><strong>Material:</strong> ${materialName}</li>
          <li><strong>Cambios:</strong></li>
          ${Object.entries(changes)
            .map(([key, value]) => `<li>${key}: ${value}</li>`)
            .join('')}
        </ul>
        <p>Este es un mensaje automático del sistema de inventario.</p>
      </div>
    `
  }),

  materialLow: (materialName: string, currentQuantity: number) => ({
    subject: `Alerta: Stock Bajo - ${materialName}`,
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Alerta de Stock Bajo</h2>
        <p>El siguiente material está por debajo del nivel mínimo recomendado:</p>
        <ul>
          <li><strong>Material:</strong> ${materialName}</li>
          <li><strong>Cantidad Actual:</strong> ${currentQuantity}</li>
        </ul>
        <p>Por favor, considere reabastecer este material pronto.</p>
      </div>
    `
  }),

  loanApproved: (studentName: string, materialName: string) => ({
    subject: "Préstamo Aprobado",
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Préstamo Aprobado</h2>
        <p>Hola ${studentName},</p>
        <p>Tu solicitud de préstamo para <strong>${materialName}</strong> ha sido aprobada.</p>
        <p>Puedes pasar a recoger el material cuando lo necesites.</p>
        <p>Saludos cordiales,<br>Sistema de Préstamos</p>
      </div>
    `
  }),
  
  loanDue: (studentName: string, materialName: string, dueDate: string) => ({
    subject: "Recordatorio de Devolución",
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Recordatorio de Devolución</h2>
        <p>Hola ${studentName},</p>
        <p>Este es un recordatorio para devolver el material: <strong>${materialName}</strong></p>
        <p>Fecha límite de devolución: <strong>${format(new Date(dueDate), 'PPP', { locale: es })}</strong></p>
        <p>Por favor, asegúrate de devolverlo a tiempo para evitar sanciones.</p>
        <p>Saludos cordiales,<br>Sistema de Préstamos</p>
      </div>
    `
  }),

  loanRejected: (studentName: string, materialName: string, reason: string) => ({
    subject: "Préstamo No Aprobado",
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Préstamo No Aprobado</h2>
        <p>Hola ${studentName},</p>
        <p>Lamentamos informarte que tu solicitud de préstamo para <strong>${materialName}</strong> no ha sido aprobada.</p>
        <p>Motivo: ${reason}</p>
        <p>Si tienes alguna duda, por favor contacta al administrador.</p>
        <p>Saludos cordiales,<br>Sistema de Préstamos</p>
      </div>
    `
  }),

  debtNotification: (studentName: string, studentId: string, materials: Array<{name: string, status: string}>) => ({
    subject: "Notificación de Adeudo de Materiales",
    content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 8px;">
        <div style="background-color: #B3121D; padding: 10px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2 style="color: white; margin: 0;">Notificación de Adeudo</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimado(a) <strong>${studentName}</strong>,</p>
          <p>El sistema ha registrado que tienes pendiente(s) la devolución del siguiente material:</p>
          
          <div style="background-color: #f8f8f8; border-left: 4px solid #B3121D; padding: 12px; margin: 15px 0;">
            ${materials.map(mat => `
              <div style="margin-bottom: 8px;">
                <strong style="color: #B3121D;">${mat.name}</strong>
                <br>
                <span style="font-size: 14px; color: #555;">Estado: ${mat.status}</span>
                <br>
                <span style="font-size: 14px; color: #555;">Referencia: ${studentId}</span>
              </div>
            `).join('')}
          </div>
          
          <p><strong>Acción requerida:</strong> Por favor, acude a la oficina de materiales a la brevedad posible para regularizar tu situación.</p>
          
          <p style="font-size: 14px; color: #666;">Recuerda que mantener adeudos pendientes puede afectar la autorización de futuros préstamos y trámites académicos.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="font-size: 14px;">Saludos cordiales,</p>
          <p style="margin-top: 0; font-weight: bold;">Administración de Materiales<br>Universidad La Salle</p>
        </div>
      </div>
      </div>
    `
  }),

  materialAvailable: (studentName: string, materialName: string) => ({
    subject: "Material Disponible",
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Material Disponible</h2>
        <p>Hola ${studentName},</p>
        <p>Te informamos que el material <strong>${materialName}</strong> que solicitaste ya está disponible.</p>
        <p>Puedes hacer tu solicitud de préstamo a través del sistema.</p>
        <p>Saludos cordiales,<br>Sistema de Préstamos</p>
      </div>
    `
  }),

  overdueLoan: (studentName: string, materialName: string, daysOverdue: number) => ({
    subject: "Préstamo Vencido",
    content: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Préstamo Vencido</h2>
        <p>Hola ${studentName},</p>
        <p>El préstamo del material <strong>${materialName}</strong> está vencido por <strong>${daysOverdue} días</strong>.</p>
        <p>Por favor, devuelve el material lo antes posible para evitar sanciones adicionales.</p>
        <p>Saludos cordiales,<br>Sistema de Préstamos</p>
      </div>
    `
  })
};