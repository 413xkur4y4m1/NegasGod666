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
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
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
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };

  return (
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="border-b border-sidebar-border p-4">
            <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-3">
                <Logo className="h-8 w-8" />
                <span className="text-lg font-semibold text-sidebar-foreground font-headline">LaSalle Gestiona</span>
            </Link>
        </SidebarHeader>

        <SidebarContent className="flex-1 overflow-y-auto p-4">
            <SidebarMenu>
                {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                    <SidebarMenuButton
                        isActive={pathname === item.href}
                        tooltip={{ children: item.label, side: 'right' }}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-4">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.photoURL || ''} alt={user?.nombre} />
                    <AvatarFallback>{getInitials(user?.nombre || '')}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium truncate">{user?.nombre}</span>
                    <span className="text-xs text-sidebar-foreground/70 truncate">{user?.correo}</span>
                </div>
            </div>
            <SidebarMenu className="mt-4">
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut} variant="outline" className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        <LogOut className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </div>
  );
}
