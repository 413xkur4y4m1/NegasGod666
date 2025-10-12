'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { AdminChatMessage } from './AdminChatMessage';
import { nanoid } from 'nanoid';
import { manageMaterial } from '@/ai/flows/admin-chatbot-material-management';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { createMaterial } from '@/lib/actions';
// Importamos la nueva acción del servidor para notificaciones
import { processAdminChatNotification } from '@/app/actions/chatNotifications';

export function AdminChatWindow() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: nanoid(),
      role: 'assistant',
      content: `Hola, ${user?.nombre?.split(' ')[0] || 'Admin'}. Soy tu asistente virtual. ¿Cómo puedo ayudarte a gestionar el inventario hoy? 
      
Puedes decir cosas como:
- "Agrega un nuevo material: 10 Cuchillos de chef, marca Tramontina, precio 500"
- "Muéstrame los alumnos con préstamos activos"
- "Envía una notificación de adeudo al estudiante con matrícula ABC123 por el micrófono"
- "Notifica a los estudiantes sobre devolución pendiente de material audiovisual"
- "Envía notificación a todos los alumnos que tienen adeudos"
- "Procesa esta lista de alumnos con adeudos: [seguido de la lista]"`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newUserMessage: ChatMessageType = {
      id: nanoid(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Fetch context data for the AI
      const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'alumno')),
        get(ref(db, 'materiales')),
      ]);

      const context = {
        loans: JSON.stringify(loansSnapshot.val() || {}),
        users: JSON.stringify(usersSnapshot.val() || {}),
        materials: JSON.stringify(materialsSnapshot.val() || {}),
      };
      
      // Detectar si es una solicitud de notificación
      const isNotificationRequest = input.toLowerCase().includes('notific') || 
                                    input.toLowerCase().includes('avisa') || 
                                    input.toLowerCase().includes('envia') || 
                                    input.toLowerCase().includes('alerta') ||
                                    input.toLowerCase().includes('correo') ||
                                    input.toLowerCase().includes('email') ||
                                    input.toLowerCase().includes('mensaje') ||
                                    input.toLowerCase().includes('comunicar') ||
                                    input.toLowerCase().includes('adeudo') ||
                                    input.toLowerCase().includes('informa') ||
                                    input.toLowerCase().includes('contacta') ||
                                    input.toLowerCase().includes('oficina') ||
                                    (input.toLowerCase().includes('manda') && 
                                     (input.toLowerCase().includes('alumno') || 
                                      input.toLowerCase().includes('estudiante')));
      
      // Registrar las operaciones que vamos a realizar para diagnóstico
      console.log(`[Operación] Tipo de solicitud: ${isNotificationRequest ? 'Notificación' : 'Consulta o acción'}`);
      
      let assistantResponseContent;
      
      if (isNotificationRequest) {
        // Para notificaciones, utilizamos la nueva Server Action
        try {
          console.log(`[AdminChatWindow] Solicitando envío de notificación: "${input}"`);
          
          // Verificar si es una solicitud para notificar a todos los estudiantes con adeudos
          const notifyAll = input.toLowerCase().includes('todos') && 
                           (input.toLowerCase().includes('alumnos') || input.toLowerCase().includes('estudiantes')) &&
                           (input.toLowerCase().includes('adeudo') || input.toLowerCase().includes('deben'));
          
          // Llamar a la Server Action para procesar la notificación
          let result;
          
          if (notifyAll) {
            // Importar dinámicamente la función para notificar a todos
            const { notifyAllStudentsWithDebts } = await import('@/app/actions/chatNotifications');
            result = await notifyAllStudentsWithDebts();
          } else {
            result = await processAdminChatNotification({ input });
          }
          
          if (result.success) {
            // Si hay detalles de envío múltiple, formatear un mensaje detallado
            if (result.details) {
              const { successful, failed } = result.details;
              assistantResponseContent = `✅ ${result.message}\n\n${successful.length > 0 ? 
                `**Notificaciones enviadas exitosamente a:**\n${successful.map((s: {nombre: string, matricula: string}) => `- ${s.nombre} (${s.matricula || 'Sin matrícula'})`).join('\n')}` : 
                ''}${failed.length > 0 ? 
                `\n\n**No se pudieron enviar notificaciones a:**\n${failed.map((f: {nombre: string, matricula: string, reason: string}) => `- ${f.nombre} (${f.matricula || 'Sin matrícula'}): ${f.reason}`).join('\n')}` : 
                ''}`;
            } else {
              assistantResponseContent = result.message;
            }
            
            toast({
              title: '¡Notificación enviada!',
              description: result.message,
            });
          } else {
            assistantResponseContent = result.message;
            
            toast({
              variant: 'destructive',
              title: 'Error de notificación',
              description: result.message,
            });
          }
        } catch (error) {
          console.error("[AdminChatWindow] Error al procesar notificación:", error);
          
          // Generar mensaje de error genérico en caso de error no controlado
          const errorMessage = error instanceof Error 
            ? `No pude enviar la notificación: ${error.message}` 
            : "Ocurrió un error inesperado al intentar enviar la notificación.";
          
          assistantResponseContent = errorMessage;
          
          toast({
            variant: 'destructive',
            title: 'Error de sistema',
            description: errorMessage,
          });
        }
      } else {
        // Usar el flujo de gestión de materiales
        const response = await manageMaterial({
          userQuery: input,
          context: context,
        });
        
        assistantResponseContent = response.response;

        // If the AI identifies it's not a data query, we assume it's a material management task
        if (!response.isDataQuery) {
          // Simple parsing for "add material" command as a PoC
          if (input.toLowerCase().includes('agrega') || input.toLowerCase().includes('añade')) {
            try {
              // This is a simplified parser. A real app would use a more robust solution.
              const details = input.split(':')[1]?.trim().split(',');
              const name = details[0].trim().substring(details[0].trim().indexOf(' ')).trim();
              const quantity = parseInt(details[0].trim().split(' ')[0]);
              const brandDetail = details.find(d => d.includes('marca'));
              const brand = brandDetail ? brandDetail.split('marca')[1].trim() : 'N/A';
              const priceDetail = details.find(d => d.includes('precio'));
              const price = priceDetail ? parseInt(priceDetail.split('precio')[1].trim()) : 0;

              await createMaterial({
                nombre: name,
                cantidad: quantity,
                marca: brand,
                precio_unitario: price,
                precio_ajustado: price,
                anio_compra: new Date().getFullYear(),
                proveedor: 'N/A',
                tipo: 'N/A',
              });

              assistantResponseContent = `¡Hecho! Se agregaron ${quantity} unidades de "${name}" al inventario.`;

              toast({
                title: 'Material Agregado',
                description: `${name} ha sido añadido al inventario.`,
              });

            } catch (e: any) {
              console.error(e);
              assistantResponseContent = "No pude agregar el material. El formato debe ser: 'Agrega X [nombre], marca [marca], precio [precio]'";
              toast({ variant: 'destructive', title: 'Error al agregar', description: e.message });
            }
          }
        }
      }

      // If the AI identifies it's not a data query, we assume it's a material management task
      // Este código ya no es necesario aquí porque se movió al bloque else del manejo de notificaciones

      const newAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: assistantResponseContent,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
      
    } catch (error: any) {
      console.error(error);
      const errorAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: 'Lo siento, tuve un problema al procesar tu solicitud. Por favor, intenta de nuevo.',
      };
      setMessages((prev) => [...prev, errorAssistantMessage]);
       toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: error.message || 'No se pudo comunicar con el asistente.',
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col h-[50vh] border rounded-lg overflow-hidden">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <AdminChatMessage
              key={message.id}
              message={message}
            />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-3 justify-start">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Procesando...</span>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4 bg-background/80">
        <form onSubmit={handleSendMessage} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu comando..."
            className="pr-24"
            disabled={isLoading}
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            <Button type="submit" size="sm" className="mr-2" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}