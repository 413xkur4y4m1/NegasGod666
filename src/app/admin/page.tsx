'use client';

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ChefHat, GanttChartSquare, TriangleAlert, CookingPot, Sparkles } from "lucide-react";
import { AdminChatWindow } from "@/components/admin/AdminChatWindow";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
// CORRECTED: Import Zod schemas for parsing
import { Material, Loan, User, MaterialSchema, LoanSchema, UserSchema } from "@/lib/types";

// Tipos para las estadísticas
interface DashboardStats {
  totalMaterials: number;
  availableMaterials: number;
  activeLoans: number;
  overdueLoans: number;
  totalUsers: number;
  mostLoanedMaterial: string;
}

// Componente principal del Dashboard del Administrador
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const materialsRef = ref(db, 'materiales');
    const loansRef = ref(db, 'prestamos');
    const usersRef = ref(db, 'usuarios');

    const unsubscribeMaterials = onValue(materialsRef, (snapshot) => {
      const materialsData = snapshot.val();
      if (materialsData) {
        // CORRECTED: Parse and validate data from Firebase
        const materialsArray = Object.values(materialsData)
          .map(m => MaterialSchema.safeParse(m))
          .filter(p => p.success)
          .map(p => (p as any).data);
          
        const totalMaterials = materialsArray.length;
        const availableMaterials = materialsArray.filter(m => (m.cantidad || 0) > 0).length;
        setStats(prev => ({ ...prev!, totalMaterials, availableMaterials }));
      }
    }, (err) => setError("Error al cargar materiales."));

    const unsubscribeLoans = onValue(loansRef, (snapshot) => {
        const loansData = snapshot.val();
        if (loansData) {
          // CORRECTED: Parse and validate data from Firebase
          const loansArray = Object.values(loansData)
            .map(l => LoanSchema.safeParse(l))
            .filter(p => p.success)
            .map(p => (p as any).data);

            const activeLoans = loansArray.filter(p => p.status === 'activo').length;
            const overdueLoans = loansArray.filter(p => p.status === 'vencido').length;

            const materialCounts: { [key: string]: number } = {};
            loansArray.forEach(loan => {
                if (loan.materialName) {
                  materialCounts[loan.materialName] = (materialCounts[loan.materialName] || 0) + 1;
                }
            });
            const mostLoanedMaterial = Object.keys(materialCounts).length > 0 
                ? Object.entries(materialCounts).sort((a, b) => b[1] - a[1])[0][0]
                : 'N/A';

            setStats(prev => ({ ...prev!, activeLoans, overdueLoans, mostLoanedMaterial }));
        }
    }, (err) => setError("Error al cargar préstamos."));

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val();
      if (usersData) {
        // CORRECTED: Parse and validate data from Firebase
        const usersArray = Object.values(usersData)
          .map(u => UserSchema.safeParse(u))
          .filter(p => p.success)
          .map(p => (p as any).data);

        const totalUsers = usersArray.length;
        setStats(prev => ({ ...prev!, totalUsers }));
      }
    }, (err) => setError("Error al cargar usuarios."));
    
    setLoading(false);

    return () => {
      unsubscribeMaterials();
      unsubscribeLoans();
      unsubscribeUsers();
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
             <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard de Gastronomía</h1>
             <p className="text-muted-foreground">Visualiza en tiempo real el estado de los préstamos y el inventario del laboratorio.</p>
        </header>

        {error && (
            <Card className="bg-destructive/10 border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Error al Cargar Datos</CardTitle>
                    <CardDescription className="text-destructive/80">{error}</CardDescription>
                </CardHeader>
            </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <StatCard 
                icon={<ChefHat className="h-6 w-6 text-primary" />} 
                title="Materiales Totales" 
                value={loading ? '...' : `${stats?.availableMaterials ?? '--'} / ${stats?.totalMaterials ?? '--'}`}
                description="Disponibles / Total"
            />
            <StatCard 
                icon={<GanttChartSquare className="h-6 w-6 text-primary" />} 
                title="Préstamos Activos" 
                value={loading ? '...' : stats?.activeLoans ?? '--'} 
            />
            <StatCard 
                icon={<TriangleAlert className="h-6 w-6 text-destructive" />} 
                title="Préstamos Vencidos" 
                value={loading ? '...' : stats?.overdueLoans ?? '--'} 
                isWarning={true}
            />
            <StatCard 
                icon={<CookingPot className="h-6 w-6 text-primary" />} 
                title="Material Más Popular" 
                value={loading ? '...' : stats?.mostLoanedMaterial || 'N/A'}
                description="Basado en el historial"
            />
        </div>

        <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-headline">Asistente de Laboratorio</CardTitle>
                    <CardDescription>
                        Usa comandos para gestionar inventario, consultar préstamos y enviar notificaciones.
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
