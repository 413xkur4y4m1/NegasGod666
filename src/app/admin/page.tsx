
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Users, Package, GanttChartSquare, TriangleAlert, Bot, BrainCircuit } from "lucide-react";
import { AdminChatWindow } from "@/components/admin/AdminChatWindow";
import { getDashboardStatsAction } from "@/app/actions/getDashboardStats";

// Convertimos el componente a async para poder usar Server Actions
export default async function AdminDashboardPage() {
    // Llamamos a nuestra nueva acción para obtener las estadísticas y el análisis de la IA
    const { success, data, error } = await getDashboardStatsAction();

    // Extraemos los datos para usarlos más fácilmente
    const stats = data?.stats;
    const analysis = data?.analysis.analysis;

    return (
        <div className="flex flex-col gap-8">
            {/* Mostramos un error si la carga de datos falla */}
            {!success && (
                <Card className="bg-destructive/10 border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error al Cargar Estadísticas</CardTitle>
                        <CardDescription className="text-destructive/80">{error}</CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Sección de Análisis de la IA */}
            {success && analysis && (
                <Card className="shadow-lg bg-primary/5">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <BrainCircuit className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-headline">Análisis del Asistente de IA</CardTitle>
                            <CardDescription>
                                Un resumen de la situación actual de la biblioteca generado por IA.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-base text-foreground/90">{analysis}</p>
                    </CardContent>
                </Card>
            )}
            
            {/* Tarjetas de Estadísticas actualizadas con datos reales */}
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <StatCard 
                    icon={<Package className="h-6 w-6 text-primary" />} 
                    title="Materiales Disponibles" 
                    value={`${stats?.availableMaterials ?? '--'} / ${stats?.totalMaterials ?? '--'}`} 
                    description="Disponibles / Total"
                />
                <StatCard 
                    icon={<GanttChartSquare className="h-6 w-6 text-primary" />} 
                    title="Préstamos Activos" 
                    value={stats?.activeLoans ?? '--'} 
                />
                <StatCard 
                    icon={<TriangleAlert className="h-6 w-6 text-destructive" />} 
                    title="Préstamos Vencidos" 
                    value={stats?.overdueLoans ?? '--'} 
                    isWarning={true}
                />
                <StatCard 
                    icon={<Users className="h-6 w-6 text-primary" />} 
                    title="Material Más Popular" 
                    value={stats?.mostLoanedMaterial || 'N/A'}
                    description="Basado en el historial"
                />
            </div>

            {/* Chatbot Administrativo que ya existía */}
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                        <Bot className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-headline">Asistente Administrativo</CardTitle>
                        <CardDescription>
                            Gestiona el inventario, consulta datos y realiza acciones con comandos de voz o texto.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <AdminChatWindow />
                </CardContent>
            </Card>
        </div>
    );
}

// Componente de tarjeta de estadística, actualizado para mostrar una descripción
interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: number | string;
    description?: string;
    isWarning?: boolean;
}

function StatCard({ icon, title, value, description, isWarning }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${isWarning ? 'text-destructive' : ''}`}>{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${isWarning ? 'text-destructive' : ''}`}>{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}
