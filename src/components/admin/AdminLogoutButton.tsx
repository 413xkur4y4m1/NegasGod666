'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function AdminLogoutButton() {
  // Función simplificada para cerrar sesión de admin
  const handleLogout = () => {
    console.log("AdminLogoutButton - Cerrando sesión de admin");
    localStorage.removeItem('userData');
    window.location.href = '/admin/login';
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleLogout}
      title="Cerrar sesión"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}