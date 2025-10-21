'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType, Loan, Debt } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { nanoid } from 'nanoid';
import { chatbotAssistedLoanRequest, ChatbotOutputSchema } from '@/ai/flows/chatbot-assisted-loan-requests';
import { createLoan } from '@/lib/actions';
import { z } from 'zod';

export function ChatWindow() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: nanoid(),
      role: 'assistant',
      content: `¡Hola ${user?.nombre?.split(' ')[0] || ''}! Soy ${user?.chatbotName || 'tu asistente'}, ¿en qué puedo ayudarte hoy? Puedes pedirme materiales, o preguntarme por tu historial de préstamos y adeudos.`,
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

    const newUserMessage: ChatMessageType = { id: nanoid(), role: 'user', content: input };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const assistantResponse: z.infer<typeof ChatbotOutputSchema> = await chatbotAssistedLoanRequest({ 
        userQuery: input,
        studentMatricula: user!.matricula,
      });

      const newAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: assistantResponse.responseText,
        materialOptions: assistantResponse.materialOptions,
        loansHistory: assistantResponse.loansHistory as Loan[],
        debtsHistory: assistantResponse.debtsHistory as Debt[],
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
      idMaterial: material.id,
      nombreMaterial: material.name,
      matriculaAlumno: user.matricula,
      nombreAlumno: user.nombre,
      status: 'pendiente',
    };

    const confirmationMessage: ChatMessageType = {
      id: nanoid(),
      role: 'assistant',
      content: `Perfecto, estás solicitando: **${material.name}**. Por favor, dime para qué materia es y cuándo lo devolverás.`,
      isConfirmation: true,
      loanRequest: loanRequest,
    };
    setMessages(prev => [...prev, confirmationMessage]);
  };
  
  const handleLoanConfirmation = async (loanRequest: Partial<Loan>, materia: string, fechaLimite: string) => {
    if (!user) return;

    const finalLoanRequest: Partial<Loan> = {
      ...loanRequest,
      materia,
      fechaLimite: fechaLimite,
      fechaPrestamo: new Date().toISOString().split('T')[0],
    };

    setIsLoading(true);
    try {
        await createLoan(finalLoanRequest as Loan);
        const confirmationMessage: ChatMessageType = {
            id: nanoid(),
            role: 'assistant',
            content: `Tu solicitud de préstamo para **${finalLoanRequest.nombreMaterial}** ha sido enviada con éxito. Te notificaremos cuando sea aprobada.`,
        };
        setMessages(prev => [...prev, confirmationMessage]);
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
         const errorMessage: ChatMessageType = {
            id: nanoid(),
            role: 'assistant',
            content: `Hubo un error al procesar tu solicitud para **${finalLoanRequest.nombreMaterial}**. Por favor, intenta de nuevo más tarde.`,
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] border rounded-lg overflow-hidden shadow-lg">
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
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 border-2 border-primary rounded-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2 rounded-tl-none">
                     <p className="text-sm text-muted-foreground">Pensando...</p>
                </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4 bg-background/95">
        <form onSubmit={handleSendMessage} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Habla con ${user?.chatbotName || 'tu asistente'}...`}
            className="pr-20"
            disabled={isLoading}
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            <Button type="submit" size="icon" className="mr-2 w-8 h-8" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
