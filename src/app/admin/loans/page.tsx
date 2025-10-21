
// src/app/admin/loans/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Loan, LoanSchema } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, GanttChartSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, isValid, parseISO } from 'date-fns';

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loansRef = ref(db, 'prestamos');
    const unsubscribe = onValue(loansRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loanList = Object.keys(data).map(key => {
            const parsed = LoanSchema.safeParse({ id_prestamo: key, ...data[key] });
            if (parsed.success) {
                return parsed.data;
            }
            console.warn(`Invalid loan data for key ${key}:`, parsed.error);
            return null;
        }).filter((loan): loan is Loan => loan !== null);

        setLoans(loanList.sort((a, b) => {
          const dateA = a.fechaPrestamo ? parseISO(a.fechaPrestamo).getTime() : 0;
          const dateB = b.fechaPrestamo ? parseISO(b.fechaPrestamo).getTime() : 0;
          return dateB - dateA;
        }));
      } else {
        setLoans([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'Fecha inválida';
  }

  const getStatusVariant = (status: Loan['status']) => {
    switch (status) {
      case 'activo': return 'default';
      case 'pendiente': return 'secondary';
      case 'devuelto': return 'outline';
      case 'perdido': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
            <GanttChartSquare className="h-6 w-6" />
            Gestión de Préstamos
        </CardTitle>
        <CardDescription>Aquí puedes ver el historial completo de préstamos.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : loans.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Fecha de Préstamo</TableHead>
                  <TableHead>Fecha Límite</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.idPrestamo}>
                    <TableCell>
                      <div className="font-medium">{loan.nombreAlumno}</div>
                      <div className="text-sm text-muted-foreground">{loan.matriculaAlumno}</div>
                    </TableCell>
                    <TableCell>{loan.nombreMaterial}</TableCell>
                    <TableCell>{formatDate(loan.fechaPrestamo)}</TableCell>
                    <TableCell>{formatDate(loan.fechaLimite)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(loan.status)}>{loan.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay préstamos registrados en el sistema.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
