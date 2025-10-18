
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, PanelLeft } from 'lucide-react';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user && isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        {/* Menú lateral para pantallas grandes */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <AppSidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 md:px-6">
            <div className="flex items-center gap-4">
                {/* Botón de hamburguesa para pantallas pequeñas */}
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="lg:hidden">
                            <PanelLeft className="h-5 w-5" />
                            <span className="sr-only">Abrir menú</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0">
                        <AppSidebar />
                    </SheetContent>
                </Sheet>

                <h1 className="text-xl font-bold hidden md:block">Panel Administrativo LaSalle</h1>
            </div>
            
            <AdminLogoutButton />
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Verificando acceso...</p>
      </div>
    </div>
  );
}
