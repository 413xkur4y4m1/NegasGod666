'use client';

import { notificationTemplates } from './notificationTemplates';

/**
 * Versión del cliente para enviar notificaciones
 * Esta versión es compatible con el navegador y utiliza API fetch para enviar las notificaciones
 */
export async function sendClientNotification({
  to,
  subject,
  content,
  recipientName = ''
}: {
  to: string;
  subject: string;
  content: string;
  recipientName?: string;
}) {
  try {
    console.log(`[Cliente] Enviando notificación a ${recipientName} (${to})`);
    
    // Validación básica
    if (!to || !to.includes('@')) {
      throw new Error(`El correo destino no es válido: ${to}`);
    }
    
    // Llamar a la API route del servidor para enviar correos
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        content,
        recipientName
      }),
    });

    // Capturar el texto de respuesta para diagnóstico
    const responseText = await response.text();
    
    // Intentar parsear como JSON, pero manejar caso en que no sea JSON válido
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[Cliente] Error al parsear respuesta:', responseText);
      throw new Error(`Respuesta del servidor no es JSON válido: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      console.error('[Cliente] Error del servidor:', data);
      throw new Error(data.error || `Error del servidor: ${response.status} ${response.statusText}`);
    }
    
    console.log(`[Cliente] Notificación enviada exitosamente usando método: ${data.method || 'api'}`);
    
    return {
      success: true,
      method: data.method || 'api',
      id: data.id || 'sent',
      recipientName
    };
  } catch (error) {
    console.error('[Cliente] Error al enviar notificación:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// Re-exportamos las plantillas para usarlas en el cliente
export { notificationTemplates };