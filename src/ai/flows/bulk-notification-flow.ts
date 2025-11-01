'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { sendNotificationEmail } from '@/lib/send-notification';
import { User, Debt, Loan } from '@/lib/types';

// --- Esquemas y Tipos ---
const BulkNotificationDetailsSchema = z.object({
  targetGroup: z.enum(['debtors', 'with_loans', 'all']).describe('El grupo de destinatarios: deudores, con préstamos activos, o todos.'),
  subject: z.string().describe('El asunto de la notificación.'),
  content: z.string().describe('El contenido HTML de la notificación.'),
});

const BulkNotificationInputSchema = z.object({ userQuery: z.string() });

// --- Prompt de IA Definido ---
const bulkNotificationPrompt = ai.definePrompt({
  name: 'bulkNotificationPrompt',
  input: { schema: BulkNotificationInputSchema },
  output: { schema: BulkNotificationDetailsSchema },
  prompt: `Analiza la siguiente solicitud de un administrador para enviar notificaciones masivas. Extrae el grupo de destinatarios y genera un asunto y contenido apropiados.\n\nGrupos posibles:\n- 'debtors': Usuarios con adeudos pendientes.\n- 'with_loans': Usuarios con préstamos activos.\n- 'all': Todos los usuarios registrados.\n\nSolicitud: "{{{userQuery}}}"`, 
});

// --- Flujo Principal ---
export const bulkNotificationFlow = ai.defineFlow(
  {
    name: 'bulkNotificationFlow',
    inputSchema: BulkNotificationInputSchema,
    outputSchema: z.object({ response: z.string() }),
  },
  async ({ userQuery }) => {
    logger.action('system', 'bulk-flow-start', { query: userQuery });

    // 1. Usar IA para entender la consulta del administrador
    const { output: details } = await bulkNotificationPrompt({ userQuery });

    if (!details) {
      const error = new Error('La IA no pudo procesar la solicitud de notificación masiva.');
      logger.error('system', 'ia-process-fail', error);
      return { response: error.message };
    }

    const { targetGroup, subject, content } = details;
    logger.action('system', 'target-group-identified', { targetGroup });

    // 2. Obtener todos los usuarios para tener sus detalles (email, uid, matricula)
    const usersRef = ref(db, 'alumnos');
    const usersSnapshot = await get(usersRef);
    if (!usersSnapshot.exists()) {
      return { response: 'No se encontraron usuarios para notificar.' };
    }
    const allUsers: { [uid: string]: User } = usersSnapshot.val();
    const allUsersList = Object.values(allUsers);

    let targetUsers: User[] = [];
    let reason = '';

    // 3. Filtrar usuarios según el grupo objetivo
    switch (targetGroup) {
      case 'all':
        targetUsers = allUsersList;
        reason = 'todos los usuarios';
        break;

      case 'debtors':
        const debtsRef = ref(db, 'adeudos');
        const debtsSnapshot = await get(debtsRef);
        if (debtsSnapshot.exists()) {
          const allDebts: { [id: string]: Debt } = debtsSnapshot.val();
          const debtorMatriculas = new Set(Object.values(allDebts).filter(d => d.status === 'pendiente').map(d => d.matriculaAlumno));
          targetUsers = allUsersList.filter(u => debtorMatriculas.has(u.matricula));
        }
        reason = 'usuarios con adeudos';
        break;

      case 'with_loans':
        const loansRef = ref(db, 'prestamos');
        const loansSnapshot = await get(loansRef);
        if (loansSnapshot.exists()) {
          const allLoans: { [id: string]: Loan } = loansSnapshot.val();
          const userWithLoanMatriculas = new Set(Object.values(allLoans).filter(l => l.status === 'activo').map(l => l.matriculaAlumno));
          targetUsers = allUsersList.filter(u => userWithLoanMatriculas.has(u.matricula));
        }
        reason = 'usuarios con préstamos activos';
        break;
    }

    if (targetUsers.length === 0) {
      return { response: `No se encontraron usuarios en el grupo: ${reason}.` };
    }

    // 4. Enviar notificaciones en paralelo
    const notificationPromises = targetUsers.map(user =>
      sendNotificationEmail({
        to: user.correo,
        subject,
        content,
        userId: user.uid,
      })
    );

    try {
      await Promise.all(notificationPromises);
      logger.action('system', 'bulk-notify-success', { count: targetUsers.length, group: reason });
      return { response: `✅ ¡Éxito! Se enviaron notificaciones a ${targetUsers.length} ${reason}.` };
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error('Error desconocido al enviar notificaciones');
      logger.error('system', 'bulk-notify-fail', typedError, { rawError: error });
      return { response: 'Ocurrió un error al intentar enviar las notificaciones. Algunas no pudieron ser enviadas.' };
    }
  }
);
