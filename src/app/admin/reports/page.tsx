'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { generateStatisticalReport } from '@/ai/flows/ai-driven-statistical-reports';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

export default function ReportsPage() {
    const [report, setReport] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setReport('');
        try {
            // Fetch all necessary data from Firebase
            const materialRef = ref(db, 'materiales');
            const loanRef = ref(db, 'prestamos');
            const userRef = ref(db, 'alumno');

            const [materialSnapshot, loanSnapshot, userSnapshot] = await Promise.all([
                get(materialRef),
                get(loanRef),
                get(userRef),
            ]);

            const materialData = JSON.stringify(materialSnapshot.val() || {});
            const loanData = JSON.stringify(loanSnapshot.val() || {});
            const userData = JSON.stringify(userSnapshot.val() || {});

            if (materialData === '{}' || loanData === '{}' || userData === '{}') {
                toast({
                    variant: 'destructive',
                    title: 'Datos insuficientes',
                    description: 'No hay suficientes datos en la base de datos para generar un reporte.',
                });
                setIsLoading(false);
                return;
            }

            const result = await generateStatisticalReport({
                materialData,
                loanData,
                userData,
            });
            
            setReport(result.report);

            toast({
                title: 'Reporte Generado',
                description: 'El análisis estadístico ha sido completado.',
            });

        } catch (error) {
            console.error('Error generating report:', error);
            toast({
                variant: 'destructive',
                title: 'Error al generar reporte',
                description: 'No se pudo completar el análisis. Intenta de nuevo.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                    <BrainCircuit className="h-6 w-6" />
                    Reportes Estadísticos con IA
                </CardTitle>
                <CardDescription>
                    Genera análisis sobre patrones de daño en materiales, comportamiento de usuarios y predicciones de préstamos.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleGenerateReport} disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generando...
                        </>
                    ) : (
                        'Generar Reporte Estadístico'
                    )}
                </Button>

                <div className="space-y-2">
                    <h3 className="font-semibold">Resultado del Análisis:</h3>
                    <div className="p-4 border rounded-md min-h-[300px] bg-muted/50">
                        {isLoading ? (
                             <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground">El análisis puede tomar unos momentos...</p>
                            </div>
                        ) : report ? (
                            <p className="whitespace-pre-wrap text-sm">{report}</p>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground">El reporte aparecerá aquí.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
