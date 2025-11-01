'use client';

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ChefHat, GanttChartSquare, TriangleAlert, CookingPot, Sparkles } from "lucide-react";
import { AdminChatWindow } from "@/components/admin/AdminChatWindow";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { Material, Loan, Debt, MaterialSchema, LoanSchema, DebtSchema } from "@/lib/types";
import { StatCard } from "@/components/admin/StatCard"; // CORRECTED: Import the refactored component

// Tipos para las estadísticas
interface DashboardStats {
  totalMaterials: number;
  availableMaterials: number;
  activeLoans: number;
  overdueLoans: number;
  mostLoanedMaterial: string;
}

// Componente principal del Dashboard del Administrador
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const materialsRef = ref(db, 'materiales');
    const loansRef = ref(db, 'prestamos');
    const debtsRef = ref(db, 'adeudos');

    const listeners = [
      onValue(materialsRef, (snapshot) => {
        const data = snapshot.val();
        const parsed = data ? Object.values(data).map(m => MaterialSchema.safeParse(m)).filter(p => p.success).map(p => (p as any).data) : [];
        setMaterials(parsed);
      }, (err) => setError("Error al cargar materiales.")),

      onValue(loansRef, (snapshot) => {
        const data = snapshot.val();
        const parsed = data ? Object.values(data).map(l => LoanSchema.safeParse(l)).filter(p => p.success).map(p => (p as any).data) : [];
        setLoans(parsed);
      }, (err) => setError("Error al cargar préstamos.")),
      
      onValue(debtsRef, (snapshot) => {
        const data = snapshot.val();
        const parsed = data ? Object.values(data).map(d => DebtSchema.safeParse(d)).filter(p => p.success).map(p => (p as any).data) : [];
        setDebts(parsed);
      }, (err) => setError("Error al cargar adeudos.")),
    ];

    setLoading(false);

    return () => {
      listeners.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  useEffect(() => {
    const totalMaterials = materials.length;
    const availableMaterials = materials.filter(m => (m.cantidad || 0) > 0).length;
    const activeLoans = loans.filter(p => p.status === 'activo').length;
    const overdueLoans = loans.filter(p => p.status === 'pendiente').length;

    const materialCounts: { [key: string]: number } = {};
    loans.forEach(loan => {
        if (loan.nombreMaterial) {
          materialCounts[loan.nombreMaterial] = (materialCounts[loan.nombreMaterial] || 0) + 1;
        }
    });
    debts.forEach(debt => {
        if (debt.nombreMaterial) {
          materialCounts[debt.nombreMaterial] = (materialCounts[debt.nombreMaterial] || 0) + 1;
        }
    });
    const mostLoanedMaterial = Object.keys(materialCounts).length > 0 
        ? Object.entries(materialCounts).sort((a, b) => b[1] - a[1])[0][0]
        : 'N/A';

    setStats({
      totalMaterials,
      availableMaterials,
      activeLoans,
      overdueLoans,
      mostLoanedMaterial
    });

  }, [materials, loans, debts]);


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
                description="Basado en préstamos y adeudos"
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

// CORRECTED: The StatCard component and its interface have been removed from this file.
