export interface User {
  uid: string;
  matricula: string;
  nombre: string;
  apellido_p?: string;
  apellido_m?: string;
  correo: string;
  carrera?: string;
  photoURL?: string | null;
  chatbotName?: string;
  isAdmin: boolean;
  provider: 'microsoft.com' | 'password' | 'manual';
  fecha_registro: string;
  ultimo_acceso: string;
}

export interface Loan {
  idPrestamo: string;
  idMaterial: string;
  nombreMaterial: string;
  matriculaAlumno: string;
  nombreAlumno: string;
  fechaPrestamo: string;
  fechaLimite: string;
  estado: 'activo' | 'devuelto' | 'perdido' | 'pendiente' | 'vencido';
  materia?: string; 
  precioUnitario?: number;
}

export interface Material {
  id: string;
  nombre: string;
  cantidad: number;
  disponibles: number;
  marca: string;
  categoria: string;
  fecha_adquisicion: string;
  estado: string;
  imageUrl?: string;
}

export interface Debt {
    id: string;
    matricula_alumno: string;
    nombre_alumno: string;
    id_material: string;
    nombre_material: string;
    monto: number;
    descripcion: string;
    estado: 'pendiente' | 'pagado';
    fecha_adeudo: string;
    fecha_actualizacion: string;
}

// FIX: Se añaden los historiales de préstamos y adeudos como propiedades opcionales.
// Se elimina la propiedad obsoleta 'loanDetails'.
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  materialOptions?: { id: string; name: string; imageUrl?: string }[];
  isConfirmation?: boolean;
  loanRequest?: Partial<Loan>;
  loansHistory?: Loan[];
  debtsHistory?: Debt[];
}
