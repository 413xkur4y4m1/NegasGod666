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
- "Muéstrame los alumnos con préstamos activos"`,
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
      
      const response = await manageMaterial({
        userQuery: input,
        context: context,
      });

      let assistantResponseContent = response.response;

      // If the AI identifies it's not a data query, we assume it's a material management task
      if (!response.isDataQuery) {
        // Simple parsing for "add material" command as a PoC
        if (input.toLowerCase().includes('agrega') || input.toLowerCase().includes('añade')) {
           try {
             // This is a simplified parser. A real app would use a more robust solution.
             const details = input.split(':')[1]?.trim().split(',');
             const name = details[0].trim().substring(details[0].trim().indexOf(' ')).trim();
             const quantity = parseInt(details[0].trim().split(' ')[0]);
             const brand = details.find(d => d.includes('marca'))?.split('marca')[1].trim() || 'N/A';
             const price = parseInt(details.find(d => d.includes('precio'))?.split('precio')[1].trim()) || 0;

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