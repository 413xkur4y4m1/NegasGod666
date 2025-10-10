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
  id_prestamo: string;
  id_material: string;
  nombre_material: string;
  matricula_alumno: string;
  nombre_alumno: string;
  fecha_prestamo: string;
  fecha_limite: string;
  estado: 'activo' | 'devuelto' | 'perdido' | 'pendiente';
  materia: string;
  precio_unitario: number;
}

export interface Material {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_ajustado: number;
  marca: string;
  anio_compra: number;
  proveedor: string;
  tipo: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  materialOptions?: { id: string; name: string; imageUrl?: string }[];
  loanDetails?: string;
  isConfirmation?: boolean;
  loanRequest?: Partial<Loan>;
}
