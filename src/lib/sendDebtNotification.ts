import { sendOutlookNotification } from './notifications';
import { notificationTemplates } from './notificationTemplates';

export async function sendDebtNotification(
  studentEmail: string,
  studentName: string,
  studentId: string,
  materials: Array<{name: string, status: string}>
) {
  try {
    const template = notificationTemplates.debtNotification(
      studentName,
      studentId,
      materials
    );

    await sendOutlookNotification({
      to: studentEmail,
      ...template
    });

    return true;
  } catch (error) {
    console.error('Error sending debt notification:', error);
    return false;
  }
}