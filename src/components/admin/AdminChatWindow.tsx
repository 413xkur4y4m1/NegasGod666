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
// Importamos ÚNICAMENTE la acción del router principal
import { mainRouterAction } from '@/app/actions/mainRouterAction';

export function AdminChatWindow() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: nanoid(),
      role: 'assistant',
      content: `Hola, ${user?.nombre?.split(' ')[0] || 'Admin'}. Soy tu asistente virtual inteligente. ¿Qué necesitas?
      
Puedes pedir cosas como:
- "Crea 5 nuevos taladros marca DeWalt"
- "Muéstrame los alumnos con préstamos vencidos"
- "Envía un recordatorio al alumno con matrícula 12345"
- "Notifica a todos los que deben material"`,
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

    let assistantResponseContent = '';

    try {
      // El frontend ya no tiene lógica, solo llama a la acción del router.
      console.log(`[AdminChatWindow] Enviando solicitud al router principal: "${input}"`);
      const result = await mainRouterAction({ input });

      // El formato de la respuesta (incluyendo listas detalladas) ya viene del backend.
      assistantResponseContent = result.message;
      
      if (result.success) {
        toast({ title: '¡Solicitud Procesada!', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error al Procesar', description: result.message });
      }
      
    } catch (error: any) {
      console.error('[AdminChatWindow] Error general:', error);
      assistantResponseContent = 'Lo siento, tuve un problema crítico al procesar tu solicitud. Por favor, revisa la consola o contacta al administrador.';
       toast({
        variant: 'destructive',
        title: 'Error Crítico',
        description: error.message || 'No se pudo procesar la solicitud.',
      });
    } finally {
      const newAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: assistantResponseContent,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
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