'use client';

import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Loader2 } from 'lucide-react';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  // El AuthProvider es la única fuente de verdad para las redirecciones.
  // Este layout solo se preocupa de mostrar el contenido correcto.

  // Mientras se verifica la autenticación, muestra un loader genérico.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Si el usuario está autenticado y es un administrador, muestra el panel.
  // La protección de ruta para usuarios no autenticados o no administradores
  // es manejada exclusivamente por AuthProvider, que ya los habrá redirigido.
  if (user && isAdmin) {
    return (
      <SidebarProvider>
        <Sidebar>
          <AppSidebar />
        </Sidebar>
        <SidebarInset>
          <div className="flex justify-between items-center px-4 py-2 border-b">
            <h1 className="text-xl font-bold">Panel Administrativo LaSalle</h1>
            <AdminLogoutButton />
          </div>
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Si no es admin, AuthProvider se encargará de la redirección. 
  // Mostramos un loader para evitar cualquier parpadeo del contenido antiguo.
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Verificando acceso...</p>
      </div>
    </div>
  );
}
