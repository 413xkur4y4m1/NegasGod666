import { NextResponse } from 'next/server';
import { sendServerNotification } from '@/app/actions/notifications';

export async function POST(request: Request) {
  try {
    console.log('[API] Recibida solicitud de envío de notificación');
    
    // Intentar obtener el cuerpo JSON de la solicitud
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[API] Error al parsear JSON de la solicitud:', jsonError);
      return NextResponse.json({ error: 'El cuerpo de la solicitud no es JSON válido' }, { status: 400 });
    }
    
    const { to, subject, content, recipientName } = body;
    
    console.log(`[API] Destino: ${to}`);
    console.log(`[API] Asunto: ${subject}`);
    console.log(`[API] Destinatario: ${recipientName || 'No especificado'}`);
    
    // Validar campos requeridos
    if (!to || !subject || !content) {
      console.error('[API] Faltan campos requeridos:', { to, subject, contentLength: content?.length });
      return NextResponse.json({ error: 'Faltan campos requeridos: to, subject, content' }, { status: 400 });
    }
    
    // Validar formato de correo electrónico básico
    if (!to.includes('@')) {
      console.error('[API] Formato de correo inválido:', to);
      return NextResponse.json({ error: `Formato de correo inválido: ${to}` }, { status: 400 });
    }
    
    console.log('[API] Enviando notificación a través de la acción del servidor...');
    
    // Enviar notificación usando la acción del servidor
    const result = await sendServerNotification({ 
      to, 
      subject, 
      content,
      recipientName: recipientName || ''
    });
    
    console.log(`[API] Notificación enviada exitosamente usando método: ${result.method}`);
    
    return NextResponse.json({
      success: true,
      method: result.method,
      id: result.id,
      recipientName: result.recipientName
    });
    
  } catch (error) {
    console.error('[API] Error en API de notificaciones:', error);
    return NextResponse.json({ 
      error: `Error al enviar notificación: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    }, { status: 500 });
  }
}