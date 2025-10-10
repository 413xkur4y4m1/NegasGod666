'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType, Loan } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { nanoid } from 'nanoid';
import { chatbotAssistedLoanRequest } from '@/ai/flows/chatbot-assisted-loan-requests';
import { createLoan } from '@/lib/actions';


export function ChatWindow() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: nanoid(),
      role: 'assistant',
      content: `¡Hola ${user?.nombre?.split(' ')[0] || ''}! Soy ${user?.chatbotName || 'tu asistente'}, ¿en qué puedo ayudarte hoy? Puedes pedirme materiales como "Quiero un sartén" o "Necesito varios platos".`,
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
      const assistantResponse = await chatbotAssistedLoanRequest({ 
        userQuery: input,
        studentName: user?.nombre,
        studentMatricula: user?.matricula
      });

      const newAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: assistantResponse.materialOptions && assistantResponse.materialOptions.length > 0
          ? `Encontré estas opciones para ti. ${assistantResponse.loanDetails || ''}`
          : `No encontré materiales que coincidan con tu búsqueda. ¿Puedes ser más específico? ${assistantResponse.loanDetails || ''}`,
        materialOptions: assistantResponse.materialOptions,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch (error) {
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
        description: 'No se pudo comunicar con el asistente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMaterial = (material: { id: string; name: string }) => {
    if (!user) return;
    
    const loanRequest: Partial<Loan> = {
      id_material: material.id,
      nombre_material: material.name,
      matricula_alumno: user.matricula,
      nombre_alumno: user.nombre,
      estado: 'pendiente',
    };

    const confirmationMessage: ChatMessageType = {
      id: nanoid(),
      role: 'assistant',
      content: `Perfecto, estás solicitando: **${material.name}**. Por favor, dime para qué materia es y la fecha en que lo devolverás. Por ejemplo: "Es para Cocina 1, lo devuelvo el 25 de diciembre".`,
      isConfirmation: true,
      loanRequest: loanRequest,
    };
    setMessages(prev => [...prev, confirmationMessage]);
  };
  
  const handleLoanConfirmation = async (loanRequest: Partial<Loan>, materia: string, fecha_limite: string) => {
    if (!user) return;

    const finalLoanRequest: Partial<Loan> = {
      ...loanRequest,
      materia,
      fecha_limite,
      fecha_prestamo: new Date().toISOString().split('T')[0],
    };

    const confirmationMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: `Tu solicitud de préstamo ha sido enviada. Te notificaremos cuando sea aprobada.`,
    };
    
    setMessages(prev => [...prev, confirmationMessage]);
    setIsLoading(true);

    try {
        await createLoan(finalLoanRequest);
        toast({
            title: "Solicitud de Préstamo Creada",
            description: "Tu solicitud ha sido registrada y está pendiente de aprobación.",
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error al crear préstamo",
            description: "No se pudo registrar tu solicitud. Intenta de nuevo.",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[60vh] border rounded-lg overflow-hidden">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onSelectMaterial={handleSelectMaterial}
              onLoanConfirmation={handleLoanConfirmation}
            />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-3 justify-start">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4 bg-background/80">
        <form onSubmit={handleSendMessage} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Habla con ${user?.chatbotName || 'tu asistente'}...`}
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
