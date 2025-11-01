'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Loan, LoanSchema } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

export default function PrestamosPage() {
  const { user } = useAuth();
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    if (!user || !user.matricula) return;

    setLoading(true);
    const loansRef = ref(db, 'prestamos');
    // Usamos una query de Firebase para filtrar por matrícula del alumno, es más eficiente
    const userLoansQuery = query(loansRef, orderByChild('matricula_alumno'), equalTo(user.matricula));

    const unsubscribe = onValue(userLoansQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loanList = Object.keys(data).map(key => {
            // Aseguramos que el ID del préstamo se asigna correctamente
            const rawData = { id_prestamo: key, ...data[key] };
            const parsed = LoanSchema.safeParse(rawData);
            if (parsed.success) {
                return parsed.data;
            }
            console.warn(`Datos de préstamo inválidos para la llave ${key}:`, parsed.error);
            return null;
        }).filter((loan): loan is Loan => loan !== null);

        const sortedList = loanList.sort((a, b) => {
          const dateA = a.fechaPrestamo ? parseISO(a.fechaPrestamo).getTime() : 0;
          const dateB = b.fechaPrestamo ? parseISO(b.fechaPrestamo).getTime() : 0;
          return dateB - dateA; // Ordenar de más reciente a más antiguo
        });

        setAllLoans(sortedList);
        setFilteredLoans(sortedList);

      } else {
        setAllLoans([]);
        setFilteredLoans([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let result = allLoans;

    // 1. Filtrar por estado
    if (statusFilter !== 'todos') {
      result = result.filter(loan => loan.status === statusFilter);
    }

    // 2. Filtrar por término de búsqueda (nombre del material)
    if (searchTerm) {
      result = result.filter(loan => 
        loan.nombreMaterial.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLoans(result);
  }, [searchTerm, statusFilter, allLoans]);


  const getStatusVariant = (status: Loan['status']) => {
    switch (status) {
      case 'activo':
        return 'default';
      case 'pendiente':
      case 'vencido':
        return 'secondary'; // Se podría usar 'destructive' para vencidos
      case 'devuelto':
        return 'outline';
      case 'perdido':
        return 'destructive';
      default:
        return 'default';
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'Fecha inválida';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Mis Préstamos</CardTitle>
        <CardDescription>Aquí puedes ver tu historial de préstamos de materiales.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input 
            placeholder="Buscar por nombre de material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Select onValueChange={setStatusFilter} defaultValue="todos">
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="devuelto">Devuelto</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLoans.length > 0 ? (
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
              {filteredLoans.map((loan) => (
                <TableRow key={loan.idPrestamo}>
                  <TableCell className="font-medium">{loan.nombreMaterial}</TableCell>
                  <TableCell>{formatDate(loan.fechaPrestamo)}</TableCell>
                  <TableCell>{formatDate(loan.fechaLimite)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(loan.status)}>{loan.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tienes préstamos que coincidan con los filtros actuales.</p>
            {allLoans.length === 0 && (
              <p className="text-sm">O no tienes ningún préstamo registrado todavía. ¡Usa el asistente para solicitar uno!</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
