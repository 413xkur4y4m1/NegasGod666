'use client';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import type { ChatMessage as ChatMessageType, Loan, Debt } from '@/lib/types';
import { Bot, User as UserIcon, CheckCircle, Clock, AlertTriangle, XCircle, HandCoins, CalendarDays, BookText } from 'lucide-react';
import Image from 'next/image';
import { Logo } from '../shared/Logo';
import { Badge } from '@/components/ui/badge';

// --- Interfaces y Props ---
interface ChatMessageProps {
  message: ChatMessageType;
  onSelectMaterial: (material: { id: string; name: string }) => void;
  onLoanConfirmation: (loanRequest: Partial<Loan>, materia: string, fecha_limite: string) => void;
}

// --- Componentes de Tarjetas de Historial (NUEVO) ---

function LoanHistoryCard({ loan }: { loan: Loan }) {
  const getStatusIcon = (status: Loan['estado']) => {
    switch (status) {
      case 'activo': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'devuelto': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'vencido': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'perdido': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pendiente': return <Clock className="h-4 w-4 text-gray-500" />;
      default: return <BookText className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full text-sm">
      <CardHeader className="flex-row items-center gap-4 p-4">
        <div className="flex-shrink-0">{getStatusIcon(loan.estado)}</div>
        <div className="flex-grow">
          <p className="font-semibold">{loan.nombreMaterial}</p>
          <p className="text-xs text-muted-foreground">Materia: {loan.materia || 'N/A'}</p>
        </div>
        <Badge variant="outline" className="capitalize flex-shrink-0">{loan.estado}</Badge>
      </CardHeader>
      <CardContent className="p-4 border-t text-xs grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2"><CalendarDays className="h-3 w-3"/><span>Préstamo:</span><span className="font-medium">{loan.fechaPrestamo}</span></div>
        <div className="flex items-center gap-2"><CalendarDays className="h-3 w-3"/><span>Límite:</span><span className="font-medium">{loan.fechaLimite}</span></div>
      </CardContent>
    </Card>
  );
}

function DebtHistoryCard({ debt }: { debt: Debt }) {
  const isPaid = debt.estado === 'pagado';
  return (
    <Card className={`w-full text-sm ${isPaid ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
        <CardHeader className="flex-row items-center gap-4 p-4">
            <div className="flex-shrink-0">
                <HandCoins className={`h-4 w-4 ${isPaid ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div className="flex-grow">
                 <p className="font-semibold">{debt.nombre_material}</p>
                 <p className="text-xs text-muted-foreground">Fecha: {debt.fecha_adeudo}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`font-bold text-lg ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                    ${debt.monto.toFixed(2)}
                </p>
                 <Badge variant={isPaid ? 'default' : 'destructive'} className="capitalize">{debt.estado}</Badge>
            </div>
        </CardHeader>
    </Card>
  )
}

// --- Componente Principal del Mensaje ---

export function ChatMessage({ message, onSelectMaterial, onLoanConfirmation }: ChatMessageProps) {
  const { user } = useAuth();
  const [materia, setMateria] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');

  const handleConfirmLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.loanRequest && materia && fechaLimite) {
        onLoanConfirmation(message.loanRequest, materia, fechaLimite);
    }
  }

  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex items-start gap-4 ${isAssistant ? '' : 'justify-end'}`}>
      {isAssistant && (
        <Avatar className="h-10 w-10 border-2 border-primary">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/20">
            <Logo className="h-6 w-6 text-primary"/>
          </div>
        </Avatar>
      )}
      <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${isAssistant ? 'items-start' : 'items-end'}`}>
        <div className={`rounded-lg px-4 py-2 ${isAssistant ? 'bg-muted rounded-tl-none' : 'bg-primary text-primary-foreground rounded-br-none'}`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* -- Renderizado de Opciones de Material -- */}
        {message.materialOptions && message.materialOptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2 w-full">
            {message.materialOptions.map((material) => (
              <Card key={material.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelectMaterial(material)}>
                <div className="aspect-video relative">
                  <Image src={material.imageUrl || ''} alt={material.name} fill className="object-cover"/>
                </div>
                <CardContent className="p-3"><p className="font-semibold text-sm">{material.name}</p></CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* -- Renderizado de Formulario de Confirmación -- */}
        {message.isConfirmation && message.loanRequest && (
          <Card className="w-full max-w-sm mt-2">
            <CardHeader><CardTitle>Confirmar Préstamo</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleConfirmLoan} className="space-y-4">
                  <div>
                      <Label htmlFor="materia">Materia</Label>
                      <Input id="materia" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ej. Cocina 1" required/>
                  </div>
                  <div>
                      <Label htmlFor="fecha_limite">Fecha de Devolución</Label>
                      <Input id="fecha_limite" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} required/>
                  </div>
                    <Button type="submit" className="w-full">Confirmar Solicitud</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* -- Renderizado de Historial de Préstamos y Adeudos (NUEVO) -- */}
        {(message.loansHistory || message.debtsHistory) && (
            <div className="w-full space-y-3 mt-2">
                {message.loansHistory && message.loansHistory.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm ml-2">Historial de Préstamos</h3>
                        {message.loansHistory.map(loan => <LoanHistoryCard key={loan.idPrestamo} loan={loan} />)}
                    </div>
                )}
                 {message.debtsHistory && message.debtsHistory.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm ml-2">Historial de Adeudos</h3>
                        {message.debtsHistory.map(debt => <DebtHistoryCard key={debt.id} debt={debt} />)}
                    </div>
                )}
            </div>
        )}

      </div>
      {!isAssistant && (
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.photoURL || ''} alt={user?.nombre} />
          <AvatarFallback>{user?.nombre?.substring(0, 2) || 'U'}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
