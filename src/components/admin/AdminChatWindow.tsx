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
- "Muéstrame los alumnos con adeudos"`,
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
      // Basic command parsing to decide which flow to call
      let response;
      if (input.toLowerCase().includes('agrega') || input.toLowerCase().includes('añade')) {
         response = await manageMaterial({
            action: 'add',
            materialDetails: input
         });
         const newAssistantMessage: ChatMessageType = {
            id: nanoid(),
            role: 'assistant',
            content: `${response.confirmation} ${response.materialId ? `(ID: ${response.materialId})` : ''}`,
         };
         setMessages((prev) => [...prev, newAssistantMessage]);
      } else {
        // Placeholder for other admin commands (get debts, users, etc.)
        const placeholderMessage: ChatMessageType = {
            id: nanoid(),
            role: 'assistant',
            content: `Entendido. Procesando tu solicitud: "${input}". Esta funcionalidad está en desarrollo.`,
        };
        setMessages((prev) => [...prev, placeholderMessage]);
      }
      
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
