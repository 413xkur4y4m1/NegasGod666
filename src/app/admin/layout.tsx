'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader2 } from 'lucide-react';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Lógica ultra simplificada para admin layout
    
    if (loading) {
      console.log("AdminLayout - Cargando estado de autenticación");
      return;
    }
    
    // Evitamos redirecciones en la página de login
    if (window.location.pathname === '/admin/login') {
      console.log("AdminLayout - En página de login, no hacemos nada");
      return;
    }
    
    // Verificamos si hay datos en localStorage (nuestra nueva forma simplificada)
    const storedUserData = localStorage.getItem('userData');
    let storedUser = null;
    
    if (storedUserData) {
      try {
        storedUser = JSON.parse(storedUserData);
        console.log("AdminLayout - Usuario encontrado en localStorage:", !!storedUser);
      } catch (e) {
        console.error("AdminLayout - Error al parsear datos de usuario:", e);
      }
    }
    
    // Si no hay usuario en localStorage o el usuario no es admin, redirigir
    if (!storedUser || !storedUser.isAdmin) {
      console.log("AdminLayout - No hay usuario admin válido, redirigiendo a login");
      window.location.href = '/admin/login';
      return;
    }
    
    // Si llegamos aquí, tenemos un usuario admin válido
    console.log("AdminLayout - Usuario admin validado desde localStorage");
  }, [loading]);

  // Mostrar pantalla de carga o contenido según corresponda
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirigiendo...</p>
        </div>
      </div>
    );
  }

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
