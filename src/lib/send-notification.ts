'use server';

import { sendOutlookNotification } from './notifications';
import { db } from './firebase';
import { ref, push, set } from 'firebase/database';

/**
 * Envía una notificación utilizando el mejor método disponible
 * Y, además, la guarda en la base de datos para el componente de la campana.
 */
export async function sendNotificationEmail({
  to,
  subject,
  content,
  userId,
}: {
  to: string;
  subject: string;
  content: string;
  userId: string; // <-- AÑADIDO: ID del usuario para la campana
}) {
  console.log(`[Servidor] Iniciando envío de notificación para userId: ${userId}`);

  // Tarea 1: Guardar la notificación para la campana en Firebase
  try {
    const notificationsRef = ref(db, 'notificaciones');
    const newNotificationRef = push(notificationsRef);
    await set(newNotificationRef, {
      userId,
      subject,
      message: content,
      read: false,
      timestamp: new Date().toISOString(),
    });
    console.log(`[Servidor] Notificación de campana guardada para userId: ${userId}`);
  } catch (error) {
    console.error(`[Servidor] Falló el guardado de notificación de campana. Error: ${error}`);
    // Continuamos para que al menos se intente enviar el email
  }

  // Tarea 2: Enviar el correo electrónico vía Outlook
  try {
    console.log(`[Servidor] Intentando enviar correo a ${to} vía Outlook...`);
    const result = await sendOutlookNotification({ to, subject, content });
    console.log(`[Servidor] Correo enviado exitosamente a ${to}. ID: ${result.id}`);
    return { success: true, provider: 'outlook', id: result.id };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[Servidor] Falló el envío de correo a ${to}. Error: ${errorMessage}`);
    return { success: false, provider: 'outlook', error: errorMessage };
  }
}
