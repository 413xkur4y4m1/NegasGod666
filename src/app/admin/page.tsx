import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Users, Package, GanttChartSquare, TriangleAlert, Bot } from "lucide-react";
import { AdminChatWindow } from "@/components/admin/AdminChatWindow";

export default function AdminDashboardPage() {
    // In a real app, these values would be fetched from Firebase
    const stats = {
        students: 125,
        materials: 89,
        activeLoans: 15,
        debts: 3,
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <StatCard icon={<Users className="h-6 w-6 text-primary" />} title="Estudiantes" value={stats.students} />
                <StatCard icon={<Package className="h-6 w-6 text-primary" />} title="Materiales" value={stats.materials} />
                <StatCard icon={<GanttChartSquare className="h-6 w-6 text-primary" />} title="Préstamos Activos" value={stats.activeLoans} />
                <StatCard icon={<TriangleAlert className="h-6 w-6 text-destructive" />} title="Adeudos" value={stats.debts} />
            </div>

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

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: number | string;
}

function StatCard({ icon, title, value }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}
