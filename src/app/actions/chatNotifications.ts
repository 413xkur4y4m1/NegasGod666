'use server';

import { sendServerNotification } from './notifications';
import { notificationTemplates } from '@/lib/notificationTemplates';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

interface NotificationPayload {
  input: string;
}

/**
 * Función de búsqueda difusa mejorada para encontrar coincidencias de nombre.
 */
function fuzzyMatch(alumnos: any[], searchText: string): any | null {
  // Extraer términos de búsqueda (palabras con longitud > 2)
  const searchTerms = searchText.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  // Extraer también pares de palabras para nombres compuestos como "Daniel Alejandro"
  const searchPairs: string[] = [];
  for (let i = 0; i < searchTerms.length - 1; i++) {
    searchPairs.push(`${searchTerms[i]} ${searchTerms[i+1]}`);
  }
  
  // Variables para encontrar la mejor coincidencia
  let bestMatch = null;
  let bestScore = 0;
  let candidates: {alumno: any, score: number, nombre: string}[] = [];

  if (alumnos.length === 0) {
    console.log('[FuzzyMatch] No hay alumnos para buscar coincidencias');
    return null;
  }

  console.log(`[FuzzyMatch] Buscando entre ${alumnos.length} alumnos`);
  console.log(`[FuzzyMatch] Términos: ${searchTerms.join(', ')}`);
  console.log(`[FuzzyMatch] Pares: ${searchPairs.join(', ')}`);

  // Primera pasada: buscar coincidencias exactas de pares de nombres
  if (searchPairs.length > 0) {
    for (const alumno of alumnos) {
      if (!alumno || !alumno.nombre) continue;
      
      const nombreCompleto = String(alumno.nombre || '').toLowerCase();
      
      // Buscar coincidencias exactas de pares de nombres (ej. "Daniel Alejandro")
      for (const pair of searchPairs) {
        if (nombreCompleto.includes(pair)) {
          // Si encontramos una coincidencia exacta de par de nombres, es muy probablemente el alumno correcto
          console.log(`[FuzzyMatch] ¡Coincidencia exacta de par! "${pair}" en "${nombreCompleto}" - Candidato prioritario`);
          return alumno; // Retornamos inmediatamente este alumno
        }
      }
    }
  }

  // Segunda pasada: evaluación completa de puntuación para cada alumno
  for (const alumno of alumnos) {
    if (!alumno || !alumno.nombre) continue;

    let score = 0;
    const nombreCompleto = String(alumno.nombre || '').toLowerCase();
    const nombrePartes = nombreCompleto.split(' ');
    const matricula = String(alumno.matricula || '');
    const correo = (alumno.correo || alumno.email || '').toLowerCase();

    // Encontrar cuántos términos de búsqueda coinciden con partes del nombre
    let matchingTermsCount = 0;
    const matchedTerms: string[] = [];

    // Coincidencia exacta de nombre completo
    if (searchText.toLowerCase().includes(nombreCompleto) || nombreCompleto.includes(searchText.toLowerCase())) {
      score += 150; // Mayor puntuación que antes
      console.log(`[FuzzyMatch] Coincidencia exacta para "${nombreCompleto}" - +150 puntos`);
    }

    // Coincidencia de matrícula
    if (matricula && searchText.includes(matricula)) {
      score += 200; // Mayor puntuación para matrícula
      console.log(`[FuzzyMatch] Coincidencia de matrícula "${matricula}" - +200 puntos`);
    }

    // Coincidencia de partes del nombre (con criterios mejorados)
    for (const term of searchTerms) {
      let termMatched = false;
      for (const parte of nombrePartes) {
        // Coincidencia exacta de una parte del nombre
        if (parte === term) {
          score += 60; // Mayor puntuación
          termMatched = true;
          matchedTerms.push(term);
          console.log(`[FuzzyMatch] Coincidencia exacta de parte "${parte}" - +60 puntos`);
        } 
        // Coincidencia parcial (parte del nombre contiene el término)
        else if (parte.includes(term) && term.length > 3) {
          score += 30;
          if (!termMatched) {
            termMatched = true;
            matchedTerms.push(term);
          }
          console.log(`[FuzzyMatch] Coincidencia parcial de "${term}" en "${parte}" - +30 puntos`);
        }
        // El término contiene la parte del nombre (menor prioridad)
        else if (term.includes(parte) && parte.length > 3) {
          score += 10;
          console.log(`[FuzzyMatch] Término "${term}" contiene "${parte}" - +10 puntos`);
        }
      }
      
      if (termMatched) {
        matchingTermsCount++;
      }
    }

    // Bonus importante: si todos los términos de búsqueda tienen coincidencia
    if (matchingTermsCount === searchTerms.length && searchTerms.length > 0) {
      score += 100;
      console.log(`[FuzzyMatch] Todos los términos coinciden - +100 puntos`);
    }
    
    // Bonus por orden: si los términos aparecen en el mismo orden
    if (matchedTerms.length > 1) {
      let orderMatches = true;
      let lastIndex = -1;
      
      for (const term of matchedTerms) {
        const index = nombreCompleto.indexOf(term);
        if (index > lastIndex) {
          lastIndex = index;
        } else {
          orderMatches = false;
          break;
        }
      }
      
      if (orderMatches) {
        score += 50;
        console.log(`[FuzzyMatch] Términos en el mismo orden - +50 puntos`);
      }
    }

    // Coincidencia de iniciales (ej. "Carlos P.")
    const inicialesInput = searchTerms.map(t => t[0]).join('');
    const inicialesAlumno = nombrePartes.map(p => p[0] || '').join('');
    if (inicialesAlumno.includes(inicialesInput) && inicialesInput.length > 1) {
      score += 20; // Menor puntuación que antes
      console.log(`[FuzzyMatch] Coincidencia de iniciales "${inicialesInput}" en "${inicialesAlumno}" - +20 puntos`);
    }

    // Coincidencia de correo
    if (correo && searchText.toLowerCase().includes(correo)) {
      score += 200; // Mayor puntuación para correo
      console.log(`[FuzzyMatch] Coincidencia exacta de correo "${correo}" - +200 puntos`);
    }

    // Guardar este candidato para comparación
    if (score >= 30) { // Solo consideramos candidatos con puntuación mínima
      candidates.push({
        alumno,
        score,
        nombre: nombreCompleto
      });
    }

    // Actualizar mejor coincidencia
    if (score > bestScore) {
      bestScore = score;
      bestMatch = alumno;
    }
  }

  // Ordenar candidatos por puntuación
  candidates.sort((a, b) => b.score - a.score);
  
  // Mostrar los candidatos principales
  if (candidates.length > 0) {
    console.log(`[FuzzyMatch] Candidatos encontrados:`);
    candidates.slice(0, 3).forEach((c, i) => {
      console.log(`  ${i + 1}. "${c.nombre}" - ${c.score} puntos`);
    });
  }
  
  // Si tenemos una coincidencia clara (la primera es mucho mejor que la segunda)
  if (candidates.length >= 2) {
    const scoreDiff = candidates[0].score - candidates[1].score;
    if (scoreDiff > 50) {
      console.log(`[FuzzyMatch] Coincidencia clara: "${candidates[0].nombre}" supera por ${scoreDiff} puntos`);
      return candidates[0].alumno;
    }
  }

  // Define un umbral de puntuación para considerar la coincidencia como válida
  console.log(`[FuzzyMatch] Mejor coincidencia: ${bestMatch?.nombre || 'Ninguna'} con puntuación: ${bestScore}`);
  
  // Umbral más alto para evitar falsos positivos con nombres comunes
  if (bestScore >= 60) { 
    return bestMatch;
  }

  return null;
}

/**
 * Extrae posibles nombres de persona del texto de entrada
 */
function extractPossibleNames(text: string): string[] {
  // Buscar patrones como "a [nombre]" o "para [nombre]" que suelen preceder a un nombre
  const namePatterns = [
    // Patrones para notificaciones específicas
    /(?:notific\w+|avisa\w*|informa\w*)\s+a\s+([A-Z][a-zñáéíóú]+(?:\s+[A-Z][a-zñáéíóú]+){0,3})/gi,
    
    // Patrones más precisos para nombres precedidos por preposiciones
    /(?:a|para|con|de)\s+([A-Z][a-zñáéíóú]+(?:\s+[A-Z][a-zñáéíóú]+){0,3})(?:\s+(?:sobre|por|de|con|acerca)|\s*$)/gi,
    
    // Patrones para referencias de estudiantes
    /(?:alumno|estudiante|persona)\s+([A-Z][a-zñáéíóú]+(?:\s+[A-Z][a-zñáéíóú]+){0,3})/gi,
    
    // Patrones para identificar matrículas y nombres asociados
    /(?:matr[ií]cula|ID)\s+\w+\s+(?:de|a)\s+([A-Z][a-zñáéíóú]+(?:\s+[A-Z][a-zñáéíóú]+){0,3})/gi,
    
    // Último recurso: buscar secuencias de palabras capitalizadas que podrían ser nombres
    /\b([A-Z][a-zñáéíóú]{2,}(?:\s+[A-Z][a-zñáéíóú]{2,}){1,2})\b/g
  ];
  
  let matches: string[] = [];
  
  // Buscar cada patrón en el texto
  for (const pattern of namePatterns) {
    const patternMatches = Array.from(text.matchAll(pattern))
      .map(m => m[1])
      .filter(Boolean);
      
    matches = [...matches, ...patternMatches];
  }
  
  // Filtrar y limpiar los resultados
  matches = matches
    .filter(match => 
      // Filtrar palabras de instrucción que podrían haber sido capturadas por error
      !['notifica', 'envía', 'manda', 'avisa', 'informa', 'sobre', 'para'].includes(match.toLowerCase()) && 
      // Asegurarse de que tiene al menos dos caracteres
      match.length > 2
    )
    .map(match => match.trim());
  
  // Devolvemos los nombres únicos encontrados
  return [...new Set(matches)];
}

interface BatchNotificationResult {
  success: boolean;
  message: string;
  details?: {
    successful: { nombre: string; matricula: string }[];
    failed: { nombre: string; matricula: string; reason: string }[];
  };
}

/**
 * Detecta si la entrada contiene una lista de estudiantes con adeudos
 */
function detectStudentDebtList(input: string): boolean {
  // Patrones que indican una lista de estudiantes con materiales pendientes
  const patrones = [
    // Patrón para listas con matrículas
    /(?:[\w\s]+)\s*\(matrícula:?\s*\d+\):\s*[^,.(]+(?:\([^)]+\))?/i,
    
    // Patrón para múltiples nombres con materiales
    /(?:los\s+)?alumnos\s+(?:con\s+adeudos?|que\s+deben\s+(?:material|equipo))/i,
    
    // Patrón para formatos de lista numérica
    /\d+\.\s*[\w\s]+:?\s*[^,.]+(?:\([^)]+\))?/
  ];
  
  // Verificar si alguno de los patrones coincide
  for (const patron of patrones) {
    if (patron.test(input)) {
      return true;
    }
  }
  
  // Verificar si hay al menos 2 menciones de "préstamo" y nombres/matrículas
  const prestamos = (input.match(/préstamo|adeudo|vencido|perdido/gi) || []).length;
  const matriculas = (input.match(/matrícula:?\s*\d+/gi) || []).length;
  
  if (prestamos >= 2 && matriculas >= 2) {
    return true;
  }
  
  return false;
}

/**
 * Busca un estudiante en la lista de alumnos por nombre o matrícula
 */
function findStudentInList(alumnos: any[], nombre: string, matricula: string): any | null {
  // Primero intentar por matrícula si está disponible
  if (matricula) {
    const alumnoByMatricula = alumnos.find(a => 
      a.matricula === matricula || 
      String(a.matricula || '') === matricula
    );
    
    if (alumnoByMatricula) return alumnoByMatricula;
  }
  
  // Si no se encuentra por matrícula, buscar por nombre
  if (nombre) {
    return fuzzyMatch(alumnos, nombre);
  }
  
  return null;
}

/**
 * Envía notificaciones a una lista de estudiantes con adeudos
 */
async function sendBatchNotifications(studentDebts: any[], alumnos: any[]): Promise<BatchNotificationResult> {
  const successful: { nombre: string; matricula: string }[] = [];
  const failed: { nombre: string; matricula: string; reason: string }[] = [];
  
  for (const debt of studentDebts) {
    try {
      // Buscar el alumno en la base de datos
      const alumnoEncontrado = findStudentInList(alumnos, debt.nombre, debt.matricula);
      
      if (!alumnoEncontrado) {
        failed.push({
          nombre: debt.nombre,
          matricula: debt.matricula,
          reason: 'No se encontró el alumno en la base de datos'
        });
        continue;
      }
      
      // Verificar que tenga correo
      const correoDestinatario = alumnoEncontrado.correo || alumnoEncontrado.email;
      const nombreDestinatario = alumnoEncontrado.nombre || '';
      
      if (!correoDestinatario || !correoDestinatario.includes('@')) {
        failed.push({
          nombre: nombreDestinatario,
          matricula: debt.matricula,
          reason: 'No tiene correo electrónico válido registrado'
        });
        continue;
      }
      
      // Preparar los materiales para la notificación
      const materiales = debt.materiales.map((m: any) => ({
        name: m.nombre,
        status: m.estado
      }));
      
      // Generar un ID de referencia único
      const materialId = `REF-${Date.now().toString().substring(8)}-${alumnoEncontrado.matricula || '0000'}`;
      
      // Enviar la notificación
      const asunto = "Notificación de Adeudo de Materiales";
      const contenido = notificationTemplates.debtNotification(
        nombreDestinatario,
        materialId,
        materiales
      ).content;
      
      await sendServerNotification({
        to: correoDestinatario,
        subject: asunto,
        content: contenido,
        recipientName: nombreDestinatario
      });
      
      successful.push({
        nombre: nombreDestinatario,
        matricula: alumnoEncontrado.matricula || debt.matricula
      });
      
    } catch (error) {
      failed.push({
        nombre: debt.nombre,
        matricula: debt.matricula,
        reason: 'Error al enviar la notificación: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }
  
  // Construir mensaje de resultado
  let message = '';
  if (successful.length > 0) {
    message = `Se enviaron notificaciones a ${successful.length} estudiantes. `;
  }
  if (failed.length > 0) {
    message += `No se pudieron enviar notificaciones a ${failed.length} estudiantes. `;
  }
  
  return {
    success: successful.length > 0,
    message,
    details: {
      successful,
      failed
    }
  };
}

/**
 * Procesa una solicitud de notificación del chat de administración
 * Busca al alumno mencionado y envía la notificación correspondiente
 */
export async function processAdminChatNotification({ input }: NotificationPayload): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    console.log(`[ProcessNotification] Procesando solicitud: "${input}"`);
    
    // Obtenemos los datos de los alumnos de Firebase
    const usersSnapshot = await get(ref(db, 'alumno'));
    const datosUsuarios = usersSnapshot.val() || {};
    const alumnos = Object.values(datosUsuarios);
    
    console.log(`[ProcessNotification] Datos obtenidos: ${alumnos.length} alumnos`);
    
    // Detectar si la entrada contiene una lista de estudiantes con adeudos
    if (detectStudentDebtList(input)) {
      console.log("[ProcessNotification] Detectada lista de estudiantes con adeudos");
      
      // Importar dinámicamente el parseador de listas de estudiantes
      const { parseStudentDebtsList } = await import('@/lib/studentDebtParser');
      
      // Extraer la información de la lista
      const studentDebts = parseStudentDebtsList(input);
      
      if (studentDebts.length === 0) {
        // Si no pudimos extraer información, indicar al usuario
        return {
          success: false,
          message: "No se pudo procesar la lista de estudiantes con adeudos. Por favor, proporciona la información en un formato más claro."
        };
      }
      
      console.log(`[ProcessNotification] Se encontraron ${studentDebts.length} estudiantes en la lista`);
      
      // Procesar las notificaciones en lote
      return await sendBatchNotifications(studentDebts, alumnos as any[]);
    }
    
    // Si no es una lista, procesamos como una notificación individual
    
    // Intentar extraer nombres específicos del texto
    const possibleNames = extractPossibleNames(input);
    console.log(`[ProcessNotification] Posibles nombres encontrados:`, possibleNames);
    
    let alumnoEncontrado = null;
    
    // Si encontramos nombres, intentamos buscar cada uno específicamente
    if (possibleNames.length > 0) {
      for (const name of possibleNames) {
        console.log(`[ProcessNotification] Buscando específicamente: "${name}"`);
        const match = fuzzyMatch(alumnos as any[], name);
        
        if (match) {
          console.log(`[ProcessNotification] Encontrado por nombre específico: "${match.nombre}"`);
          alumnoEncontrado = match;
          break;
        }
      }
    }
    
    // Si no encontramos por nombre específico, hacemos la búsqueda en todo el texto
    if (!alumnoEncontrado) {
      console.log(`[ProcessNotification] No se encontró por nombre específico, probando búsqueda general`);
      alumnoEncontrado = fuzzyMatch(alumnos as any[], input);
    }

    if (!alumnoEncontrado) {
      console.log('[ProcessNotification] No se encontró ningún alumno que coincida');
      return {
        success: false,
        message: 'No se pudo encontrar un alumno que coincida con tu búsqueda. Por favor, especifica el nombre completo o matrícula.',
      };
    }
    
    // Verificar que el alumno tenga correo
    const correoDestinatario = alumnoEncontrado.correo || alumnoEncontrado.email;
    const nombreDestinatario = alumnoEncontrado.nombre || '';
    
    if (!correoDestinatario || !correoDestinatario.includes('@')) {
      console.log(`[ProcessNotification] El alumno ${nombreDestinatario} no tiene correo válido: ${correoDestinatario}`);
      return {
        success: false,
        message: `El alumno "${nombreDestinatario}" no tiene un correo electrónico válido registrado.`
      };
    }

    console.log(`[ProcessNotification] Alumno encontrado: ${nombreDestinatario} (${correoDestinatario})`);

    // Analizar el mensaje para determinar el tipo de notificación
    let asunto, contenido;
    const mensajeLower = input.toLowerCase();

    if (mensajeLower.includes('adeud') || mensajeLower.includes('pendiente') || mensajeLower.includes('debe')) {
      // Notificación de adeudo
      
      // Patrones más sofisticados para detectar materiales mencionados
      const patrones = [
        // Patrones para materiales específicos
        /(material(es)?|equipo(s)?|herramienta(s)?|artículo(s)?)\s+([a-záéíóúüñ0-9]+(\s+[a-záéíóúüñ0-9]+){0,4})/i,
        /(?:sobre|por|de)\s+(?:la|el|los|las)?\s+([a-záéíóúüñ0-9]+(\s+[a-záéíóúüñ0-9]+){0,4})\s+(?:pendiente|no devuelt[ao]|faltante)/i,
        /(?:la|el|los|las)?\s+([a-záéíóúüñ0-9]+(\s+[a-záéíóúüñ0-9]+){0,2})\s+(?:que no ha|que aún no|sin|falta|pendiente)/i
      ];
      
      // Extraer el nombre del material
      let nombreMaterial = "mencionado en sistema";
      for (const patron of patrones) {
        const match = input.match(patron);
        if (match && match.length > 1) {
          // El grupo de captura puede estar en diferentes posiciones según el patrón
          const posibleMaterial = match[3] || match[1];
          if (posibleMaterial && posibleMaterial.length > 3 && 
              !['sobre', 'para', 'que', 'porque', 'debido'].includes(posibleMaterial.toLowerCase())) {
            nombreMaterial = posibleMaterial.trim();
            // Convertir primera letra a mayúscula
            nombreMaterial = nombreMaterial.charAt(0).toUpperCase() + nombreMaterial.slice(1);
            break;
          }
        }
      }
      
      // Generar un ID de referencia único para el material
      const materialId = `MAT-${Date.now().toString().substring(8)}`;
      
      asunto = "Notificación de Adeudo de Materiales";
      contenido = notificationTemplates.debtNotification(
        nombreDestinatario,
        materialId,
        [{ name: nombreMaterial, status: "Pendiente de devolución" }]
      ).content;
    } else if (mensajeLower.includes('disponible') || mensajeLower.includes('listo') || mensajeLower.includes('recoger')) {
      // Notificación de material disponible
      const materialMatch = input.match(/(?:material|equipo|herramienta)\s+([^,.]+)/i);
      const nombreMaterial = materialMatch ? materialMatch[1].trim() : "solicitado";
      
      asunto = "Material Disponible para Recoger";
      contenido = notificationTemplates.materialAvailable(
        nombreDestinatario,
        nombreMaterial
      ).content;
    } else if (mensajeLower.includes('vencido') || mensajeLower.includes('retrasado')) {
      // Notificación de préstamo vencido
      const materialMatch = input.match(/(?:material|equipo|herramienta)\s+([^,.]+)/i);
      const nombreMaterial = materialMatch ? materialMatch[1].trim() : "prestado";
      
      const diasMatch = input.match(/(\d+)\s*d[ií]as?/i);
      const diasRetraso = diasMatch ? parseInt(diasMatch[1]) : 3;
      
      asunto = "Préstamo con Fecha Vencida";
      contenido = notificationTemplates.overdueLoan(
        nombreDestinatario,
        nombreMaterial,
        diasRetraso
      ).content;
    } else if (mensajeLower.includes('oficina') || mensajeLower.includes('solicita') || mensajeLower.includes('llama')) {
      // Notificación para acudir a la oficina
      asunto = "Se le solicita en la oficina";
      
      // Extraer la razón de la solicitud (si existe)
      let razon = "Se requiere su presencia para tratar asuntos pendientes.";
      
      // Intentar extraer una razón más específica
      const motivoPatterns = [
        /(?:para|por|sobre|acerca de|referente a)\s+([^,.]+)/i,
        /(?:asunto|tema|motivo):\s*([^,.]+)/i
      ];
      
      for (const pattern of motivoPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
          razon = match[1].trim();
          break;
        }
      }
      
      contenido = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Solicitud de presencia en oficina</h2>
          <p>Hola ${nombreDestinatario},</p>
          <p>Se le solicita acudir a la oficina de materiales lo antes posible.</p>
          <p><strong>Motivo:</strong> ${razon}</p>
          <p>Saludos cordiales,<br>Sistema de Préstamos LaSalle</p>
        </div>
      `;
    } else {
      // Notificación general
      asunto = "Notificación del Sistema";
      
      // Extraer el contenido real del mensaje, eliminando las palabras de instrucción
      let mensajeReal = input;
      
      // Patrones comunes de instrucción que queremos eliminar
      const instruccionPatterns = [
        /^(?:envía|enviar|mandar?|notificar?|avisar?|comunicar?|informar?)\s+(?:una\s+)?(?:notificaci[óo]n|mensaje|correo|aviso|email)\s+(?:a|para|sobre)\s+[^,.:]+\s+(?:sobre|de|que|para que)\s+/i,
        /^(?:envía|enviar|mandar?|notificar?|avisar?|comunicar?|informar?)\s+(?:una\s+)?(?:notificaci[óo]n|mensaje|correo|aviso|email)\s+(?:a|para|sobre)\s+[^,.:]+\s+/i,
        /^(?:notificar?|avisar?|comunicar?|informar?)\s+(?:a|al|para)\s+[^,.:]+\s+(?:sobre|de|que|para que)\s+/i,
        /^(?:notificar?|avisar?|comunicar?|informar?)\s+(?:a|al|para)\s+[^,.:]+\s+/i
      ];
      
      // Intentar extraer el mensaje real eliminando las instrucciones
      for (const pattern of instruccionPatterns) {
        const match = mensajeReal.match(pattern);
        if (match) {
          mensajeReal = mensajeReal.replace(pattern, '');
          break;
        }
      }
      
      // Si después de eliminar las instrucciones el mensaje queda muy corto, usar un mensaje genérico
      if (mensajeReal.trim().length < 15) {
        mensajeReal = "Se le notifica de información importante del sistema de préstamos.";
      }
      
      contenido = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Notificación Importante</h2>
          <p>Hola ${nombreDestinatario},</p>
          <p>${mensajeReal}</p>
          <p>Saludos cordiales,<br>Sistema de Préstamos LaSalle</p>
        </div>
      `;
    }

    // Enviar la notificación
    try {
      console.log(`[ProcessNotification] Enviando notificación a ${nombreDestinatario} (${correoDestinatario})`);
      
      // Usamos la API existente de notificaciones
      await sendServerNotification({
        to: correoDestinatario,
        subject: asunto,
        content: contenido,
        recipientName: nombreDestinatario
      });
      
      return {
        success: true,
        message: `He enviado una notificación a ${nombreDestinatario} (${correoDestinatario}) con el asunto: ${asunto}`
      };
    } catch (error) {
      console.error('[ProcessNotification] Error al enviar notificación:', error);
      return {
        success: false,
        message: `Error al enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  } catch (error) {
    console.error('[ProcessNotification] Error general:', error);
    return {
      success: false,
      message: 'Ocurrió un error inesperado al procesar la notificación.'
    };
  }
}

/**
 * Envía notificaciones a todos los alumnos con adeudos
 */
export async function notifyAllStudentsWithDebts(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Obtener datos de Firebase
    const usersSnapshot = await get(ref(db, 'alumno'));
    const loansSnapshot = await get(ref(db, 'prestamo'));
    
    const alumnos = Object.values(usersSnapshot.val() || {});
    const prestamos = Object.values(loansSnapshot.val() || {});
    
    // Filtrar préstamos activos con fecha vencida
    const currentDate = new Date();
    const prestamosVencidos = (prestamos as any[]).filter(prestamo => 
      prestamo.estado === 'activo' && 
      new Date(prestamo.fecha_devolucion) < currentDate
    );
    
    if (prestamosVencidos.length === 0) {
      return {
        success: false,
        message: "No se encontraron préstamos vencidos en el sistema."
      };
    }
    
    // Agrupar préstamos por alumno
    const prestamosPorAlumno = new Map<string, any[]>();
    
    for (const prestamo of prestamosVencidos) {
      const alumnoId = prestamo.alumno_id;
      
      if (!prestamosPorAlumno.has(alumnoId)) {
        prestamosPorAlumno.set(alumnoId, []);
      }
      
      prestamosPorAlumno.get(alumnoId)!.push(prestamo);
    }
    
    // Procesar las notificaciones
    const successful: { nombre: string; matricula: string }[] = [];
    const failed: { nombre: string; matricula: string; reason: string }[] = [];
    
    for (const [alumnoId, prestamosAlumno] of prestamosPorAlumno.entries()) {
      try {
        // Buscar el alumno en la lista
        const alumno = (alumnos as any[]).find(a => a.id === alumnoId);
        
        if (!alumno) {
          failed.push({
            nombre: `ID: ${alumnoId}`,
            matricula: "Desconocido",
            reason: "No se encontró el alumno en la base de datos"
          });
          continue;
        }
        
        // Verificar que tenga correo
        const correoDestinatario = alumno.correo || alumno.email;
        const nombreDestinatario = alumno.nombre || '';
        const matricula = alumno.matricula || '';
        
        if (!correoDestinatario || !correoDestinatario.includes('@')) {
          failed.push({
            nombre: nombreDestinatario,
            matricula,
            reason: "No tiene correo electrónico válido registrado"
          });
          continue;
        }
        
        // Preparar los materiales para la notificación
        const materiales = prestamosAlumno.map(prestamo => ({
          name: prestamo.material_nombre || "Material sin nombre",
          status: "Préstamo vencido"
        }));
        
        // Generar un ID de referencia único
        const materialId = `REF-${Date.now().toString().substring(8)}-${matricula || '0000'}`;
        
        // Enviar la notificación
        const asunto = "Notificación de Adeudo de Materiales";
        const contenido = notificationTemplates.debtNotification(
          nombreDestinatario,
          materialId,
          materiales
        ).content;
        
        await sendServerNotification({
          to: correoDestinatario,
          subject: asunto,
          content: contenido,
          recipientName: nombreDestinatario
        });
        
        successful.push({
          nombre: nombreDestinatario,
          matricula
        });
        
      } catch (error) {
        failed.push({
          nombre: `ID: ${alumnoId}`,
          matricula: "Error",
          reason: 'Error al enviar la notificación: ' + (error instanceof Error ? error.message : String(error))
        });
      }
    }
    
    // Construir mensaje de resultado
    let message = '';
    if (successful.length > 0) {
      message = `Se enviaron notificaciones a ${successful.length} estudiantes con adeudos. `;
    }
    if (failed.length > 0) {
      message += `No se pudieron enviar notificaciones a ${failed.length} estudiantes. `;
    }
    
    return {
      success: successful.length > 0,
      message,
      details: {
        successful,
        failed
      }
    };
    
  } catch (error) {
    console.error('[NotifyAllWithDebts] Error:', error);
    return {
      success: false,
      message: `No se pudieron enviar las notificaciones: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}