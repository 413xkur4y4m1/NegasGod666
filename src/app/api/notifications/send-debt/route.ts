import { NextResponse } from 'next/server';
import { sendDebtNotification } from '@/lib/sendDebtNotification';

export async function POST(request: Request) {
  try {
    const studentData = {
      email: "daniel.perez@lasalle.edu.mx",
      name: "Daniel Alejandro Pérez Esquivel",
      id: "244650",
      materials: [
        {
          name: "Bambalina",
          status: "Perdido"
        }
      ]
    };

    await sendDebtNotification(
      studentData.email,
      studentData.name,
      studentData.id,
      studentData.materials
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Notificación de adeudo enviada exitosamente' 
    });
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}