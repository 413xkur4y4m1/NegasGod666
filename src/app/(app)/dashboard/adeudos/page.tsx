'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Adeudo, AdeudoSchema } from '@/lib/types'; // Asumiendo que crearás estos tipos
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

export default function AdeudosPage() {
  const { user } = useAuth();
  const [allAdeudos, setAllAdeudos] = useState<Adeudo[]>([]);
  const [filteredAdeudos, setFilteredAdeudos] = useState<Adeudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const adeudosRef = ref(db, 'adeudos');
    // Filtramos directamente en la consulta de Firebase para eficiencia
    const userAdeudosQuery = query(adeudosRef, orderByChild('matricula_alumno'), equalTo(user.matricula));

    const unsubscribe = onValue(userAdeudosQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const adeudoList = Object.keys(data).map(key => {
          const parsed = AdeudoSchema.safeParse({ id_adeudo: key, ...data[key] });
          if (parsed.success) {
            return parsed.data;
          }
          console.warn(`Invalid adeudo data for key ${key}:`, parsed.error);
          return null;
        }).filter((adeudo): adeudo is Adeudo => adeudo !== null);

        const sortedList = adeudoList.sort((a, b) => {
            const dateA = a.fecha_generacion ? parseISO(a.fecha_generacion).getTime() : 0;
            const dateB = b.fecha_generacion ? parseISO(b.fecha_generacion).getTime() : 0;
            return dateB - dateA;
        });

        setAllAdeudos(sortedList);
        setFilteredAdeudos(sortedList);

      } else {
        setAllAdeudos([]);
        setFilteredAdeudos([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let result = allAdeudos;

    if (statusFilter !== 'todos') {
      result = result.filter(adeudo => adeudo.estado === statusFilter);
    }

    if (searchTerm) {
      result = result.filter(adeudo => 
        adeudo.nombre_material.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAdeudos(result);
  }, [searchTerm, statusFilter, allAdeudos]);


  const getStatusVariant = (status: Adeudo['estado']) => {
    switch (status) {
      case 'pagado':
        return 'outline';
      case 'pendiente':
        return 'destructive';
      default:
        return 'secondary';
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
        <CardTitle className="font-headline">Mis Adeudos</CardTitle>
        <CardDescription>Aquí puedes ver tu historial de adeudos por materiales perdidos o dañados.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input 
                placeholder="Buscar por material..."
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
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAdeudos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdeudos.map((adeudo) => (
                <TableRow key={adeudo.id_adeudo}>
                  <TableCell className="font-medium">{adeudo.nombre_material}</TableCell>
                  <TableCell>{formatDate(adeudo.fecha_generacion)}</TableCell>
                  <TableCell>${adeudo.monto.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(adeudo.estado)}>{adeudo.estado}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>¡Felicidades! No tienes ningún adeudo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
