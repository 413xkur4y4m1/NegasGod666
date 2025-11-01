'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Loader2, BarChart, PieChart, Users } from 'lucide-react';
import { generateStatisticalReport } from '@/ai/flows/ai-driven-statistical-reports';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

// Importar los nuevos componentes de gráficas
import { MostLoanedMaterialsChart } from '@/components/charts/MostLoanedMaterialsChart';
import { LoanStatusDistributionChart } from '@/components/charts/LoanStatusDistributionChart';
import { UserActivityTable } from '@/components/charts/UserActivityTable';

// Definir tipos para los datos de las gráficas
interface ReportData {
  mostLoanedMaterials: { name: string; count: number }[];
  loanStatusDistribution: { name: string; value: number }[];
  userActivity: { studentName: string; loanCount: number }[];
}

export default function ReportsPage() {
    const [analysis, setAnalysis] = useState('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Función para extraer el bloque JSON del texto
    const extractJsonData = (text: string): ReportData | null => {
        const jsonRegex = /```json\n([\s\S]*?)\n```/;
        const match = text.match(jsonRegex);
        if (match && match[1]) {
            try {
                // Extraer solo el contenido JSON y parsearlo
                return JSON.parse(match[1]);
            } catch (error) {
                console.error("Error parsing JSON from report:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error de formato de IA',
                    description: 'No se pudo interpretar la estructura de datos del reporte.',
                });
                return null;
            }
        }
        return null;
    };

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setAnalysis('');
        setReportData(null);
        try {
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

            if (loanData === '{}') {
                toast({
                    variant: 'destructive',
                    title: 'Faltan datos de Préstamos',
                    description: 'Es necesario tener al menos un préstamo para generar un reporte.',
                });
                setIsLoading(false);
                return;
            }

            const result = await generateStatisticalReport({
                materialData, loanData, userData,
            });
            
            const fullReportText = result.report;
            const extractedData = extractJsonData(fullReportText);
            
            // Eliminar el bloque JSON del texto que se muestra al usuario
            const cleanAnalysis = fullReportText.replace(/```json[\s\S]*?```/, '').trim();

            setAnalysis(cleanAnalysis);
            if (extractedData) {
                setReportData(extractedData);
            }

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
        <div className="space-y-6">
            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline">
                        <BrainCircuit className="h-6 w-6" />
                        Reportes Estadísticos con IA
                    </CardTitle>
                    <CardDescription>
                        Genera un análisis de los patrones de préstamos y el comportamiento de los usuarios utilizando los datos actuales de la plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGenerateReport} disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                        ) : (
                            'Generar Reporte Estadístico'
                        )}
                    </Button>
                </CardContent>
                 {(analysis || isLoading) && (
                    <CardFooter>
                        <div className="space-y-4 w-full">
                            <h3 className="font-semibold text-lg">Resultado del Análisis</h3>
                            <div className="p-4 border rounded-md min-h-[200px] bg-muted/50 w-full">
                                {isLoading && !analysis ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4"/>
                                        <p className="text-muted-foreground">Analizando datos... El proceso puede tardar unos momentos.</p>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</p>
                                )}
                            </div>
                        </div>
                    </CardFooter>
                )}
            </Card>

            {reportData && !isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <BarChart className="h-5 w-5"/>
                                Materiales Más Solicitados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MostLoanedMaterialsChart data={reportData.mostLoanedMaterials} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <PieChart className="h-5 w-5"/>
                                Distribución de Préstamos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LoanStatusDistributionChart data={reportData.loanStatusDistribution} />
                        </CardContent>
                    </Card>
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Users className="h-5 w-5"/>
                                Usuarios Más Activos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UserActivityTable data={reportData.userActivity} />
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
