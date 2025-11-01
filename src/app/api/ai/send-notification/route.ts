import { NextResponse } from 'next/server';
import { notificationSenderFlow } from '@/ai/flows/notification-sender';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.query) {
      return NextResponse.json(
        { error: 'Se requiere una instrucción para la notificación' },
        { status: 400 }
      );
    }

    const result = await notificationSenderFlow({
      userQuery: body.query
    });

    // La respuesta del flujo ahora solo contiene la propiedad 'response'
    return NextResponse.json({
      success: true,
      message: result.response
    });
  } catch (error) {
    console.error('Error al procesar la notificación:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}