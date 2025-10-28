'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, LogOut, Bell, PanelLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppSidebar } from './AppSidebar';
import { Logo } from '../shared/Logo';
import { useEffect, useState } from 'react';
// REFACTORED: Import necessary firebase database functions
import { onValue, ref, query, orderByChild, equalTo, update } from 'firebase/database';
import { db } from '@/lib/firebase';
// REFACTORED: Import a generic Notification type
import type { Notification } from '@/lib/types'; 
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function AppHeader() {
  const { user, signOut, isAdmin } = useAuth();
  const pathname = usePathname();
  // REFACTORED: State now holds the new Notification type
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // REFACTORED: useEffect now fetches from the correct /notificaciones collection
  useEffect(() => {
    if (!user || !user.uid) return;

    const notificationsRef = query(
      ref(db, 'notificaciones'),
      orderByChild('userId'),
      equalTo(user.uid)
    );

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setNotifications([]);
        return;
      }
      const allUserNotifications = snapshot.val();
      const unreadNotifications: Notification[] = Object.entries(allUserNotifications)
        .map(([id, notif]: [string, any]) => ({ ...notif, id }))
        .filter(n => !n.read)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(unreadNotifications);
    });

    return () => unsubscribe();
  }, [user]);

  // NEW: Function to mark notifications as read
  const handleMarkAsRead = () => {
    if (!notifications.length) return;

    const updates: Record<string, boolean> = {};
    notifications.forEach(n => {
        if (n.id) {
            updates[`/notificaciones/${n.id}/read`] = true;
        }
    });

    update(ref(db), updates).catch(err => console.error("Error marking notifications as read:", err));
  };

  const getBreadcrumbs = () => {
    const paths = pathname.split('/').filter((p) => p);
    let breadcrumbs = paths.map((path, index) => {
      const href = '/' + paths.slice(0, index + 1).join('/');
      let label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
      if (path === 'admin' && isAdmin) {
        return null;
      }
      return { href, label };
    }).filter(Boolean) as { href: string; label: string }[];
    const homeCrumb = { href: isAdmin ? '/admin' : '/dashboard', label: 'Home' };
    if(pathname === homeCrumb.href || (isAdmin && pathname === '/admin')){
       return [homeCrumb];
    }
    return [homeCrumb, ...breadcrumbs];
  };

  const breadcrumbs = getBreadcrumbs();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };
  
  const formatTimeAgo = (dateString: string) => {
    try {
        const date = parseISO(dateString);
        return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch (error) {
        return "hace un momento";
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
       <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="lg:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs p-0">
            <AppSidebar />
          </SheetContent>
        </Sheet>
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.href}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              <Link
                href={crumb.href}
                className={`font-medium ${
                  index === breadcrumbs.length - 1
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!isAdmin && (
            // REFACTORED: Added onOpenChange to trigger mark as read
            <Popover onOpenChange={(open) => { if (!open) handleMarkAsRead() }}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                    </span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 md:w-96 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Notificaciones</h4>
                    <p className="text-sm text-muted-foreground">
                        {notifications.length > 0 ? `Tienes ${notifications.length} notificaciones no leídas.` : 'No tienes notificaciones nuevas.'}
                    </p>
                </div>
                <div className="grid gap-2">
                    {/* REFACTORED: Displaying real notifications from state */}
                    {notifications.length > 0 ? (
                        notifications.map(n => (
                            <div key={n.id} className="mb-2 p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                                <p className="font-semibold text-sm">{n.subject}</p>
                                {/* Using dangerouslySetInnerHTML because the AI generates safe HTML */}
                                <div className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: n.message.split('<img')[0] }} />
                                <p className="text-right text-[10px] text-gray-400 mt-2">{formatTimeAgo(n.timestamp)}</p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-4">¡Estás al día!</div>
                    )}
                </div>
                </div>
            </PopoverContent>
            </Popover>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.photoURL || ''} alt={user?.nombre} />
                <AvatarFallback>{getInitials(user?.nombre || '')}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.nombre}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.correo}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isAdmin && (
                <DropdownMenuItem asChild>
                <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                </Link>
                </DropdownMenuItem>
            )}
            {isAdmin && (
                <DropdownMenuItem asChild>
                <Link href="/admin/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                </Link>
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
