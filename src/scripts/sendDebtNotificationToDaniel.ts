import { sendDebtNotification } from '@/lib/sendDebtNotification';

async function notifyDanielAlejandro() {
  const studentData = {
    email: "daniel.perez@lasalle.edu.mx", // Asumiendo el correo institucional
    name: "Daniel Alejandro Pérez Esquivel",
    id: "244650",
    materials: [
      {
        name: "Bambalina",
        status: "Perdido"
      }
    ]
  };

  const success = await sendDebtNotification(
    studentData.email,
    studentData.name,
    studentData.id,
    studentData.materials
  );

  if (success) {
    console.log("Notificación de adeudo enviada exitosamente a Daniel Alejandro");
  } else {
    console.error("Error al enviar la notificación de adeudo");
  }
}

notifyDanielAlejandro();