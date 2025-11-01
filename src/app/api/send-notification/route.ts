import { NextResponse } from 'next/server';
import { sendServerNotification } from '@/app/actions/notifications';

export async function POST(request: Request) {
  try {
    console.log('[API] Recibida solicitud de envío de notificación');
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[API] Error al parsear JSON de la solicitud:', jsonError);
      return NextResponse.json({ error: 'El cuerpo de la solicitud no es JSON válido' }, { status: 400 });
    }
    
    // CORREGIDO: Se extrae userId del cuerpo de la solicitud.
    const { to, subject, content, userId } = body;
    
    console.log(`[API] Destino: ${to}`);
    console.log(`[API] Asunto: ${subject}`);
    console.log(`[API] Usuario ID: ${userId || 'No especificado'}`);
    
    // CORREGIDO: Se valida que el userId esté presente.
    if (!to || !subject || !content || !userId) {
      console.error('[API] Faltan campos requeridos:', { to, subject, contentLength: content?.length, userId });
      return NextResponse.json({ error: 'Faltan campos requeridos: to, subject, content, userId' }, { status: 400 });
    }
    
    if (!to.includes('@')) {
      console.error('[API] Formato de correo inválido:', to);
      return NextResponse.json({ error: `Formato de correo inválido: ${to}` }, { status: 400 });
    }
    
    console.log('[API] Enviando notificación a través de la acción del servidor...');
    
    // CORREGIDO: Se llama a la función con los parámetros correctos, incluyendo userId.
    // Se elimina `recipientName`.
    const result = await sendServerNotification({ 
      to, 
      subject, 
      content,
      userId
    });
    
    console.log(`[API] Notificación enviada exitosamente, proveedor: ${result.provider}`);
    
    // CORREGIDO: Se ajusta la respuesta para no incluir `recipientName`.
    return NextResponse.json({
      success: true,
      provider: result.provider,
      id: result.id,
    });
    
  } catch (error) {
    console.error('[API] Error en API de notificaciones:', error);
    return NextResponse.json({ 
      error: `Error al enviar notificación: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    }, { status: 500 });
  }
}
