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
    try {
      setLoading(true);
      const response = await fetch('/api/ai/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: instruction }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Notificación enviada',
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Error al enviar la notificación');
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
          placeholder="Ej: Envía una notificación de adeudo a Daniel Alejandro sobre la bambalina perdida"
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