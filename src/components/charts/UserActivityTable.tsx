'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TableProps {
  data: { studentName: string; loanCount: number; studentMatricula?: string }[];
}

// Función para generar iniciales del nombre
const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export function UserActivityTable({ data }: TableProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground p-4">No se encontró actividad de usuarios.</div>;
  }

  // Ordenar los datos por el número de préstamos de mayor a menor
  const sortedData = [...data].sort((a, b) => b.loanCount - a.loanCount);

  return (
    <div className="overflow-y-auto" style={{maxHeight: '350px'}}>
        <Table>
            <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                <TableHead className="w-[80%]">Nombre del Estudiante</TableHead>
                <TableHead className="text-right">Nº Préstamos</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedData.map((user, index) => (
                <TableRow key={index}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 text-xs">
                                {/* Aquí se podría añadir una imagen si estuviera disponible */}
                                <AvatarFallback>{getInitials(user.studentName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.studentName}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{user.loanCount}</TableCell>
                </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
  );
}
