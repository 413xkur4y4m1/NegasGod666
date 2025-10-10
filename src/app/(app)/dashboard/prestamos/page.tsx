// src/app/(app)/dashboard/prestamos/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Loan } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PrestamosPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loansRef = ref(db, `alumno/${user.matricula}/prestamos`);
    const unsubscribe = onValue(loansRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loanList = Object.values(data) as Loan[];
        setLoans(loanList.sort((a, b) => new Date(b.fecha_prestamo).getTime() - new Date(a.fecha_prestamo).getTime()));
      } else {
        setLoans([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusVariant = (status: Loan['estado']) => {
    switch (status) {
      case 'activo':
        return 'default';
      case 'pendiente':
        return 'secondary';
      case 'devuelto':
        return 'outline';
      case 'perdido':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Mis Préstamos</CardTitle>
        <CardDescription>Aquí puedes ver tu historial de préstamos de materiales.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : loans.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Fecha de Préstamo</TableHead>
                <TableHead>Fecha de Devolución</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id_prestamo}>
                  <TableCell className="font-medium">{loan.nombre_material}</TableCell>
                  <TableCell>{format(new Date(loan.fecha_prestamo), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{format(new Date(loan.fecha_limite), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(loan.estado)}>{loan.estado}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tienes préstamos registrados.</p>
            <p className="text-sm">¡Usa el asistente en el dashboard para solicitar uno!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
