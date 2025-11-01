
import { z } from 'zod';

// --- BASE SCHEMAS (Reflecting Firebase raw data) ---

const RawUserSchema = z.object({
  uid: z.string().optional(),
  matricula: z.string().default('000000'),
  nombre: z.string().default('Usuario de Prueba'),
  apellido_p: z.string().optional(),
  apellido_m: z.string().optional(),
  correo: z.string().email().default('test@example.com'),
  carrera: z.string().optional(),
  photoURL: z.string().optional().nullable(),
  chatbotName: z.string().optional(),
  isAdmin: z.boolean().default(false),
  provider: z.enum(['microsoft.com', 'password', 'manual']).optional(),
  fecha_registro: z.string().optional(),
  ultimo_acceso: z.string().optional(),
});

const RawLoanSchema = z.object({
  id_prestamo: z.string().default('default_id'),
  id_material: z.string().default('default_id'),
  nombre_material: z.string().default('material de prueba'),
  matricula_alumno: z.string().default('000000'),
  nombre_alumno: z.string().default('Usuario de Prueba'),
  fecha_prestamo: z.string().default(new Date().toISOString()),
  fecha_limite: z.string().default(new Date().toISOString()),
  estado: z.enum(['activo', 'devuelto', 'perdido', 'pendiente', 'vencido']).default('activo'),
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
  imageUrl: z.string().optional(),
});

const RawDebtSchema = z.union([
  z.object({
    descripcion: z.string().default('adeudo de prueba'),
    estado: z.enum(['pendiente', 'pagado']).default('pendiente'),
    fecha_actualizacion: z.string().default(new Date().toISOString()),
    fecha_adeudo: z.string().default(new Date().toISOString()),
    id_material: z.string().default('default_id'),
    matricula_alumno: z.string().default('000000'),
    monto: z.number().default(0),
    nombre_alumno: z.string().default('Usuario de Prueba'),
    nombre_material: z.string().default('material de prueba'),
  }),
  z.object({
    id: z.string().default('default_id'),
    matricula: z.string().default('000000'),
    nombre: z.string().default('Usuario de Prueba'),
    monto: z.number().default(0),
    estado: z.enum(['pendiente', 'pagado']).default('pendiente'),
    fecha: z.string().default(new Date().toISOString()),
    material: z.object({ id: z.string().default('default_id'), nombre: z.string().default('material de prueba') }),
    correo: z.string().optional(),
    asunto: z.string().optional(),
    descripcion: z.string().optional(),
    mensaje: z.string().optional(),
    tipo: z.string().optional(),
  })
]);

// NEW, CLEAN SCHEMA FOR THE ADEUDOS PAGE
export const AdeudoSchema = z.object({
    id_adeudo: z.string(),
    nombre_material: z.string(),
    fecha_generacion: z.string(),
    monto: z.number(),
    estado: z.enum(['pendiente', 'pagado']),
  });
  
export type Adeudo = z.infer<typeof AdeudoSchema>;

// --- TRANSFORMED SCHEMAS & INTERFACES (Clean, camelCase for app use) ---

export const UserSchema = RawUserSchema.transform(data => ({
  uid: data.uid ?? data.matricula,
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
  status: data.estado,
  materia: data.materia,
  precioUnitario: data.precio_unitario,
}));
export type Loan = z.infer<typeof LoanSchema>;

export const MaterialSchema = z.object({ id: z.string() }).merge(RawMaterialSchema).transform(data => ({
  id: data.id,
  nombre: data.nombre,
  cantidad: data.cantidad,
  marca: data.marca ?? 'N/A',
  precioUnitario: data.precio_unitario,
  precioAjustado: data.precio_ajustado,
  anioCompra: data.anio_compra,
  proveedor: data.proveedor,
  imageUrl: data.imageUrl,
}));
export type Material = z.infer<typeof MaterialSchema>;

export const DebtSchema = RawDebtSchema.transform(data => {
  if ('id_material' in data) {
    return {
      id: data.id_material,
      matriculaAlumno: data.matricula_alumno,
      nombreAlumno: data.nombre_alumno,
      idMaterial: data.id_material,
      nombreMaterial: data.nombre_material,
      monto: data.monto,
      descripcion: data.descripcion,
      status: data.estado,
      fechaAdeudo: data.fecha_adeudo,
      fechaActualizacion: data.fecha_actualizacion,
    };
  } else {
    return {
      id: data.id,
      matriculaAlumno: data.matricula,
      nombreAlumno: data.nombre,
      idMaterial: data.material.id,
      nombreMaterial: data.material.nombre,
      monto: data.monto,
      descripcion: data.descripcion ?? data.asunto ?? 'Sin descripción',
      status: data.estado,
      fechaAdeudo: data.fecha,
      fechaActualizacion: data.fecha,
    };
  }
});
export type Debt = z.infer<typeof DebtSchema>;

// --- NOTIFICATIONS INTERFACE (NEW) ---

export interface Notification {
    id: string;
    userId: string;
    type: string;
    subject: string;
    message: string;
    timestamp: string;
    read: boolean;
}

// --- CHATBOT & CHAT INTERFACES ---

const AiMaterialCardSchema = z.object({
  id: z.string().describe('El ID único del material.'),
  name: z.string().describe('El nombre del material.'),
});

export const EnrichedMaterialCardSchema = AiMaterialCardSchema.extend({
  imageUrl: z.string().optional().describe('La URL de la imagen para la tarjeta del material.'),
  stock: z.number().optional().describe('La cantidad total del material.'),
});

export const ChatbotOutputSchema = z.object({
  intent: z.enum(['materialSearch', 'historyInquiry', 'loanRequest', 'greeting', 'clarification', 'loanContinuation']),
  responseText: z.string(),
  materialOptions: z.array(EnrichedMaterialCardSchema).optional(),
  loansHistory: z.array(LoanSchema).optional(),
  debtsHistory: z.array(DebtSchema).optional(),
  loanRequestDetails: z.object({
    materialId: z.string(),
    materialName: z.string(),
    studentMatricula: z.string(),
    studentName: z.string(),
    loanDate: z.string().optional(),
    returnDate: z.string().optional(),
  }).optional(),
});

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  materialOptions?: { id: string; name: string; imageUrl?: string, stock?: number }[];
  isConfirmation?: boolean;
  loanRequest?: Partial<Loan>;
  loansHistory?: Loan[];
  debtsHistory?: Debt[];
}
