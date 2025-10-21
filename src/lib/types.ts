
import { z } from 'zod';

// NOTE: This file is the single source of truth for data structures.
// It has been rebuilt to reflect the REAL structure of the Firebase database,
// including inconsistencies and snake_case fields. Zod schemas are used to
// parse the raw data and transform it into a clean, consistent camelCase format
// for use throughout the application.

// --- BASE SCHEMAS (Reflecting Firebase raw data) ---

const RawUserSchema = z.object({
  uid: z.string().optional(), // UID might not be present on all records
  matricula: z.string(),
  nombre: z.string(),
  apellido_p: z.string().optional(),
  apellido_m: z.string().optional(),
  correo: z.string().email(),
  carrera: z.string().optional(),
  photoURL: z.string().optional().nullable(),
  chatbotName: z.string().optional(),
  isAdmin: z.boolean().default(false),
  provider: z.enum(['microsoft.com', 'password', 'manual']).optional(),
  fecha_registro: z.string().optional(), // snake_case from db
  ultimo_acceso: z.string().optional(),  // snake_case from db
});

const RawLoanSchema = z.object({
  id_prestamo: z.string(),
  id_material: z.string(),
  nombre_material: z.string(),
  matricula_alumno: z.string(),
  nombre_alumno: z.string(),
  fecha_prestamo: z.string(),
  fecha_limite: z.string(),
  estado: z.enum(['activo', 'devuelto', 'perdido', 'pendiente', 'vencido']),
  materia: z.string().optional(),
  precio_unitario: z.number().optional(),
});

const RawMaterialSchema = z.object({
  nombre: z.string(),
  cantidad: z.number(),
  marca: z.string().optional(),
  precio_unitario: z.number(),
  precio_ajustado: z.number().optional(),
  anio_compra: z.number().optional(),
  proveedor: z.string().optional(),
  tipo: z.string().optional(),
});

// This schema handles the WILDLY inconsistent structures in the 'adeudos' branch
const RawDebtSchema = z.union([
  // Format 1: Detailed, snake_case
  z.object({
    descripcion: z.string(),
    estado: z.enum(['pendiente', 'pagado']),
    fecha_actualizacion: z.string(),
    fecha_adeudo: z.string(),
    id_material: z.string(),
    matricula_alumno: z.string(),
    monto: z.number(),
    nombre_alumno: z.string(),
    nombre_material: z.string(),
  }),
  // Format 2: Less detailed, mixedCase
  z.object({
    id: z.string(),
    matricula: z.string(),
    nombre: z.string(),
    monto: z.number(),
    estado: z.enum(['pendiente', 'pagado']),
    fecha: z.string(),
    material: z.object({ id: z.string(), nombre: z.string() }),
    // Optional fields from this format
    correo: z.string().optional(),
    asunto: z.string().optional(),
    descripcion: z.string().optional(),
    mensaje: z.string().optional(),
    tipo: z.string().optional(),
  })
]);


// --- TRANSFORMED SCHEMAS & INTERFACES (Clean, camelCase for app use) ---

export const UserSchema = RawUserSchema.transform(data => ({
  uid: data.uid ?? data.matricula, // Ensure UID exists
  matricula: data.matricula,
  nombre: data.nombre,
  apellidoP: data.apellido_p,
  apellidoM: data.apellido_m,
  correo: data.correo,
  carrera: data.carrera,
  photoURL: data.photoURL,
  chatbotName: data.chatbotName,
  isAdmin: data.isAdmin,
  provider: data.provider ?? 'manual', 
  fechaRegistro: data.fecha_registro ?? new Date().toISOString(),
  ultimoAcceso: data.ultimo_acceso ?? new Date().toISOString(),
}));
export type User = z.infer<typeof UserSchema>;

export const LoanSchema = RawLoanSchema.transform(data => ({
  idPrestamo: data.id_prestamo,
  idMaterial: data.id_material,
  nombreMaterial: data.nombre_material,
  matriculaAlumno: data.matricula_alumno,
  nombreAlumno: data.nombre_alumno,
  fechaPrestamo: data.fecha_prestamo,
  fechaLimite: data.fecha_limite,
  status: data.estado, // CORRECTED: from 'estado' to 'status'
  materia: data.materia,
  precioUnitario: data.precio_unitario,
}));
export type Loan = z.infer<typeof LoanSchema>;

export const MaterialSchema = z.object({ id: z.string() }).merge(RawMaterialSchema).transform(data => ({
  id: data.id,
  nombre: data.nombre,
  cantidad: data.cantidad,
  // 'disponibles' is a calculated field, should not be in the base model
  marca: data.marca ?? 'N/A',
  precioUnitario: data.precio_unitario,
  precioAjustado: data.precio_ajustado,
  anioCompra: data.anio_compra,
  proveedor: data.proveedor,
}));
export type Material = z.infer<typeof MaterialSchema>;

export const DebtSchema = RawDebtSchema.transform(data => {
  if ('id_material' in data) { // Check if it's Format 1
    return {
      id: data.id_material, // best guess for a unique id
      matriculaAlumno: data.matricula_alumno,
      nombreAlumno: data.nombre_alumno,
      idMaterial: data.id_material,
      nombreMaterial: data.nombre_material,
      monto: data.monto,
      descripcion: data.descripcion,
      status: data.estado, // CORRECTED: from 'estado' to 'status'
      fechaAdeudo: data.fecha_adeudo,
      fechaActualizacion: data.fecha_actualizacion,
    };
  } else { // It's Format 2
    return {
      id: data.id,
      matriculaAlumno: data.matricula,
      nombreAlumno: data.nombre,
      idMaterial: data.material.id,
      nombreMaterial: data.material.nombre,
      monto: data.monto,
      descripcion: data.descripcion ?? data.asunto ?? 'Sin descripción',
      status: data.estado, // CORRECTED: from 'estado' to 'status'
      fechaAdeudo: data.fecha,
      fechaActualizacion: data.fecha, // Use 'fecha' as fallback
    };
  }
});
export type Debt = z.infer<typeof DebtSchema>;


// --- CHAT INTERFACE ---
// This does not need a raw schema as it's not stored directly in the DB.
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
