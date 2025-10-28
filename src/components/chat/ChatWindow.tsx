'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType, Loan, Debt, ChatbotOutputSchema } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { nanoid } from 'nanoid';
// CORRECTED IMPORT: Point to the new, correct action file.
import { createLoan } from '@/app/actions/loan'; 
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
    if (!input.trim() || isLoading || !user) return;

    const newUserMessage: ChatMessageType = { id: nanoid(), role: 'user', content: input };
    setMessages((prev) => [...prev, newUserMessage]);
    const userQuery = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/student/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userQuery, studentMatricula: user.matricula }),
      });

      if (!response.ok) {
          let errorDetails = `El servidor respondió con el estado ${response.status}`;
          try {
              const errorData = await response.json();
              errorDetails = errorData.message || errorDetails;
          } catch (e) { /* Ignore parsing error */ }
          throw new Error(errorDetails);
      }

      const assistantResponse: z.infer<typeof ChatbotOutputSchema> = await response.json();

      const newAssistantMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: assistantResponse.responseText,
        materialOptions: assistantResponse.materialOptions,
        loansHistory: assistantResponse.loansHistory as Loan[],
        debtsHistory: assistantResponse.debtsHistory as Debt[],
      };
      setMessages((prev) => [...prev, newAssistantMessage]);

    } catch (error: any) {
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

  // REWRITTEN LOGIC: This function now directly handles the loan creation.
  const handleSelectMaterial = async (material: { id: string; name: string }) => {
    if (!user) return;

    setIsLoading(true);
    const optimisticMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: `Procesando tu solicitud para **${material.name}**...`,
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Call the new, corrected server action
      const result = await createLoan({ 
        materialId: material.id,
        studentMatricula: user.matricula 
      });

      if (result.success) {
        const successMessage: ChatMessageType = {
          id: nanoid(),
          role: 'assistant',
          content: `✅ ¡Listo! El préstamo de **${material.name}** ha sido registrado. Pasa al pañol a recogerlo.`,
        };
        setMessages(prev => [...prev, successMessage]);
        toast({
          title: "Préstamo Registrado",
          description: "Puedes pasar a recoger tu material.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      const errorMessage: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: `❌ Hubo un error al registrar tu préstamo para **${material.name}**: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        variant: "destructive",
        title: "Error en el Préstamo",
        description: error.message || "No se pudo procesar la solicitud.",
      });
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
              // REMOVED: onLoanConfirmation is no longer needed.
              onLoanConfirmation={() => {}} 
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
