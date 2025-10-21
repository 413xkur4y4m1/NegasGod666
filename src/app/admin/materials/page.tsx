
'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Material, MaterialSchema } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, ImageOff } from 'lucide-react'; // Import ImageOff icon
import { logger } from '@/lib/logger';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const materialsRef = ref(db, 'materiales');
    const unsubscribe = onValue(materialsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedMaterials: Material[] = [];
        for (const key in data) {
          const result = MaterialSchema.safeParse({ id: key, ...data[key] });
          if (result.success) {
            parsedMaterials.push(result.data);
          } else {
            logger.chatbot(
              'admin',
              'invalid-material-data',
              {
                error: result.error.flatten(),
                materialId: key
              },
              'warning'
            );
          }
        }
        setMaterials(parsedMaterials);
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Cantidad Total</TableHead> {/* CORRECTED: Changed label */}
                  <TableHead className="text-right">Precio Unitario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/* CORRECTED: Replaced Image with an icon */}
                        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-md">
                          <ImageOff className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{material.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>{material.marca}</TableCell>
                    <TableCell>{material.cantidad}</TableCell> {/* CORRECTED: Changed to 'cantidad' */}
                    <TableCell className="text-right">
                      ${(material.precioUnitario || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
