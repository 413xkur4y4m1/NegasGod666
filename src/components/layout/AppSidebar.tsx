
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  GanttChartSquare,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  Settings,
  Users,
  Home,
  User,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/shared/Logo';

const studentNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/prestamos', label: 'Mis Préstamos', icon: GanttChartSquare },
  { href: '/profile', label: 'Mi Perfil', icon: User },
];

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/reports', label: 'Reportes IA', icon: LineChart },
  { href: '/admin/materials', label: 'Materiales', icon: Package },
  { href: '/admin/users', label: 'Estudiantes', icon: Users },
  { href: '/admin/loans', label: 'Préstamos', icon: GanttChartSquare },
];

export function AppSidebar() {
  const { user, signOut, isAdmin } = useAuth();
  const pathname = usePathname();
  const navItems = isAdmin ? adminNav : studentNav;

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };

  return (
      <div className="flex h-full flex-col border-r bg-card text-card-foreground">
        <header className="border-b p-4">
            <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-3">
                <Logo className="h-8 w-8" />
                <span className="text-lg font-semibold font-headline">LaSalle Gestiona</span>
            </Link>
        </header>

        <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
                {navItems.map((item) => (
                <li key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <a className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${ 
                        pathname === item.href 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-muted'
                      }`}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </a>
                    </Link>
                </li>
                ))}
            </ul>
        </nav>

        <footer className="border-t p-4">
            <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.photoURL || ''} alt={user?.nombre} />
                    <AvatarFallback>{getInitials(user?.nombre || '')}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">{user?.nombre}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.correo}</span>
                </div>
            </div>
            <Button onClick={signOut} variant="outline" className="w-full justify-center">
                <LogOut className="h-5 w-5 mr-2" />
                <span>Cerrar Sesión</span>
            </Button>
        </footer>
    </div>
  );
}
