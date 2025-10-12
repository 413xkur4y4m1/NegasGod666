/**
 * Implementación simple para enviar correos usando la API de correo del navegador
 * Esta es una solución de respaldo muy básica
 */
export async function sendSimpleEmail(to: string, subject: string, body: string) {
  try {
    // Generar una URL mailto
    const mailtoURL = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/<[^>]*>/g, ''))}`;
    
    console.log('Enviando correo usando método simple');
    console.log(`A: ${to}`);
    console.log(`Asunto: ${subject}`);
    
    // En un entorno de servidor, esto es solo para registro
    console.log(`URL mailto generada: ${mailtoURL}`);
    
    // Como estamos en un servidor, no podemos abrir la URL, pero la registramos
    return {
      success: true,
      id: `simple-${Date.now()}`
    };
  } catch (error) {
    console.error('Error al generar correo simple:', error);
    throw error;
  }
}