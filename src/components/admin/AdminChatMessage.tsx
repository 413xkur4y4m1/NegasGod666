'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { Bot } from 'lucide-react';
import { Logo } from '../shared/Logo';

interface AdminChatMessageProps {
  message: ChatMessageType;
}

export function AdminChatMessage({ message }: AdminChatMessageProps) {
  const { user } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return 'A';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };
  
  const isAssistant = message.role === 'assistant';

  // Convertimos los saltos de línea de texto a etiquetas <br> para el HTML
  const formattedContent = message.content.replace(/\n/g, '<br />');

  return (
    <div className={`flex items-start gap-4 ${isAssistant ? '' : 'justify-end'}`}>
      {isAssistant && (
        <Avatar className="h-10 w-10 border-2 border-primary">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/20">
            <Logo className="h-6 w-6 text-primary" />
          </div>
        </Avatar>
      )}
      <div
        className={`flex flex-col gap-2 max-w-[75%] ${
          isAssistant ? 'items-start' : 'items-end'
        }`}
      >
        <div
          className={`rounded-lg px-4 py-2 ${
            isAssistant
              ? 'bg-muted rounded-tl-none'
              : 'bg-primary text-primary-foreground rounded-br-none'
          }`}
        >
          {/* 
            FIX: Usamos dangerouslySetInnerHTML para renderizar el HTML que la IA genera.
            - Añadimos la clase 'prose' para un estilo tipográfico agradable.
            - El contenido se pasa a través de __html después de formatear los saltos de línea.
          */}
          <div 
            className="text-sm prose prose-sm dark:prose-invert max-w-full" 
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </div>
      </div>
      {!isAssistant && (
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.photoURL || ''} alt={user?.nombre || ''} />
          <AvatarFallback>{getInitials(user?.nombre)}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
