interface StudentDebt {
  nombre: string;
  matricula: string;
  materiales: {
    nombre: string;
    estado: string;
  }[];
}

/**
 * Analiza un texto con formato de lista de estudiantes con adeudos
 * y extrae la información de cada estudiante y sus materiales pendientes
 */
export function parseStudentDebtsList(text: string): StudentDebt[] {
  // Función simplificada para el escenario específico
  // Busca patrones de "nombre (material)" en el texto
  
  const result: StudentDebt[] = [];
  
  // Dividir el texto en frases
  const frases = text.split(/(?:,\s*|\.\s+|\n)/);
  
  for (const frase of frases) {
    if (!frase.trim()) continue;
    
    // Buscar el nombre del alumno
    const nombreMatch = frase.match(/([A-Za-z\s\u00C0-\u017Fáéíóúüñ]+)/);
    if (!nombreMatch || !nombreMatch[1]) continue;
    
    const nombre = nombreMatch[1].trim();
    
    // Buscar materiales dentro de paréntesis
    const materialesMatch = frase.match(/\(([^)]+)\)/g);
    
    if (materialesMatch && materialesMatch.length > 0) {
      // Lista para almacenar los materiales
      const materiales: {nombre: string, estado: string}[] = [];
      
      // Extraer cada material
      for (const materialParentesis of materialesMatch) {
        // Quitar paréntesis
        const material = materialParentesis.replace(/^\(|\)$/g, '').trim();
        
        // Verificar que no sea un identificador o matrícula
        if (material && 
            material.length > 2 && 
            !material.match(/undefined|matrícula|id/i)) {
          materiales.push({
            nombre: material,
            estado: 'pendiente'
          });
        }
      }
      
      // Si encontramos materiales para este alumno
      if (materiales.length > 0) {
        result.push({
          nombre,
          matricula: '',  // No extraemos matrícula en este caso
          materiales
        });
      }
    }
  }
  
  return result;
}