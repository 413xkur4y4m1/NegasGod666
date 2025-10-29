'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function NotificationTester() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendNotification = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: instruction }),
      });

      // Primero, validamos si la respuesta es OK y realmente es JSON.
      if (!response.ok) {
        // Si el servidor envía un error, intentamos leerlo, si no, usamos el status.
        const errorData = await response.json().catch(() => null); 
        throw new Error(errorData?.error || `Error del servidor: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Segundo, validamos que el objeto data exista antes de usarlo.
      if (data?.success) {
        toast({
          title: 'Notificación Procesada',
          // Usamos fusión de nulos para asegurar que siempre haya un string.
          description: data.message ?? 'El proceso se completó pero no hubo un mensaje de vuelta.',
        });
      } else {
        // Hacemos lo mismo para el mensaje de error.
        throw new Error(data?.error || 'Ocurrió un error inesperado al procesar la respuesta.');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Enviar Notificación con IA</h1>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Instrucción para la notificación:
        </label>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej: Envía una notificación de adeudo al estudiante con matrícula ABC123 sobre el equipo de video pendiente"
          className="min-h-[100px]"
        />
      </div>

      <Button
        onClick={sendNotification}
        disabled={loading || !instruction}
        className="w-full"
      >
        {loading ? 'Enviando...' : 'Enviar Notificación'}
      </Button>
    </div>
  );
}