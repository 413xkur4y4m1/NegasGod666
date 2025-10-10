// src/app/admin/materials/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Material } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package } from 'lucide-react';
import Image from 'next/image';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const materialsRef = ref(db, 'materiales');
    const unsubscribe = onValue(materialsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // The data is an object with IDs as keys, so we convert it to an array
        const materialList = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) as Material[];
        setMaterials(materialList);
      } else {
        setMaterials([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
            <Package className="h-6 w-6" />
            Gestión de Materiales
        </CardTitle>
        <CardDescription>Aquí puedes ver y gestionar el inventario de materiales.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : materials.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Cantidad Disponible</TableHead>
                <TableHead>Precio Unitario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                        <Image 
                            src={material.imageUrl || `https://picsum.photos/seed/${material.id}/40/40`}
                            alt={material.nombre}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                            data-ai-hint="kitchen utensil"
                        />
                        <span className="font-medium">{material.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell>{material.marca}</TableCell>
                  <TableCell>{material.cantidad}</TableCell>
                  <TableCell>${material.precio_unitario.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay materiales registrados en el inventario.</p>
             <p className="text-sm">Usa el Asistente Administrativo para agregar nuevos materiales.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
