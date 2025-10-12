'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser, signInWithPopup, OAuthProvider, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

import { auth, db } from '@/lib/firebase';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { User } from '@/lib/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const cleanupAuthState = useCallback(() => {
    setUser(null);
    setIsAdmin(false);
    setFirebaseUser(null);
    localStorage.removeItem('userData');
  }, []);

  const handleUserSession = useCallback(async (fbUser: FirebaseUser) => {
    const adminEmails = ['admin@lasalle.edu.mx'];
    const userIsAdmin = adminEmails.includes(fbUser.email || '');

    const matricula = fbUser.email!.split('@')[0];
    const userRef = ref(db, `alumno/${matricula}`);
    const snapshot = await get(userRef);

    let appUser: User;

    if (snapshot.exists()) {
      // Update existing user
      const dbUser = snapshot.val();
      const updates = {
        ultimo_acceso: new Date().toISOString(),
        nombre: fbUser.displayName || dbUser.nombre,
        photoURL: fbUser.photoURL || dbUser.photoURL || null,
      };
      await update(userRef, updates);
      appUser = { ...dbUser, ...updates, isAdmin: userIsAdmin, uid: fbUser.uid };
    } else {
      // Create new user for social sign-in
      const names = fbUser.displayName?.split(' ') || ['Nuevo', 'Usuario'];
      const nombre = names.slice(0, -2).join(' ') || names[0];
      const apellido_p = names.length > 2 ? names[names.length-2] : names[1] || '';
      const apellido_m = names.length > 2 ? names[names.length-1] : '';

      appUser = {
        uid: fbUser.uid,
        matricula,
        nombre: nombre,
        apellido_p: apellido_p,
        apellido_m: apellido_m,
        correo: fbUser.email!,
        isAdmin: userIsAdmin,
        provider: (fbUser.providerData[0]?.providerId as 'microsoft.com') || 'password',
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
        photoURL: fbUser.photoURL || null,
      };
      await set(userRef, appUser);
    }
    
    setUser(appUser);
    setIsAdmin(userIsAdmin);
    localStorage.setItem('userData', JSON.stringify(appUser));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        await handleUserSession(fbUser);
      } else {
        const manualUserData = localStorage.getItem('userData');
        if (manualUserData) {
          try {
            const manualUser = JSON.parse(manualUserData);
            if (manualUser.provider === 'manual') {
              setUser(manualUser);
              setIsAdmin(manualUser.isAdmin);
            } else {
              cleanupAuthState();
            }
          } catch (e) {
            cleanupAuthState();
          }
        } else {
          cleanupAuthState();
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [handleUserSession, cleanupAuthState]);
  
  useEffect(() => {
    // Solución para evitar el bucle de redirección
    
    // 1. No hacer nada mientras está cargando
    if (loading) {
      console.log("AuthProvider - Loading, no hacemos redirecciones");
      return;
    }

    // 2. Evitar completamente redirecciones si estamos en páginas de login
    const loginPages = ['/admin/login', '/login', '/signup'];
    if (loginPages.includes(pathname)) {
      console.log(`AuthProvider - Estamos en página de login (${pathname}), no redirigimos`);
      return;
    }

    // 3. Lógica de redirección para usuario autenticado
    if (user) {
      // Usuario autenticado en página pública que no sea login (ya excluidas arriba)
      const publicRoutes = ['/'];
      if (publicRoutes.includes(pathname)) {
        console.log(`AuthProvider - Usuario autenticado en ruta pública: ${pathname}, redirigiendo a ${user.isAdmin ? '/admin' : '/dashboard'}`);
        router.replace(user.isAdmin ? '/admin' : '/dashboard');
      }
    } else {
      // 4. Usuario no autenticado intentando acceder a rutas protegidas
      // Las rutas de login ya están excluidas de redirección arriba
      if (pathname.startsWith('/admin')) {
        console.log(`AuthProvider - Usuario no autenticado intentando acceder a: ${pathname}, redirigiendo a /admin/login`);
        router.replace('/admin/login');
      } else if (pathname.startsWith('/dashboard') || pathname.startsWith('/profile')) {
        console.log(`AuthProvider - Usuario no autenticado intentando acceder a: ${pathname}, redirigiendo a /login`);
        router.replace('/login');
      }
    }
  }, [user, loading, pathname, router]);
  
  const handleMicrosoftSignIn = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({
        tenant: 'common',
        prompt: 'select_account',
    });
    try {
      const result = await signInWithPopup(auth, provider);
      await handleUserSession(result.user);
      router.push(isAdmin ? '/admin' : '/dashboard');
      return result;
    } catch(error: any) {
        let description = 'No se pudo iniciar sesión con Microsoft.';
        if (error.code === 'auth/account-exists-with-different-credential') {
          description = 'Ya existe una cuenta con este correo electrónico pero con un método de inicio de sesión diferente.';
        } else if (error.code === 'auth/popup-closed-by-user') {
          description = 'El proceso de inicio de sesión fue cancelado.'
        }
        throw new Error(description);
    }
  };
  
  // Versión optimizada de handleAdminLogin para evitar bucles
  const handleAdminLogin = async (email: string, password: string) => {
    console.log("AuthProvider - Intento de login admin:", email);
    
    // Verificar que sea un correo administrativo
    if (!email.endsWith('@lasalle.edu.mx')) {
      console.log("AuthProvider - Error: correo no pertenece al dominio");
      throw new Error('El correo no pertenece al dominio de La Salle.');
    }

    try {
      // Admin manual login para desarrollo
      if (email === 'admin@lasalle.edu.mx' && password === 'admin123') {
          console.log("AuthProvider - Credenciales admin válidas");
          
          // Creamos objeto de usuario admin
          const adminUser: User = {
              uid: 'admin-manual',
              matricula: 'admin',
              nombre: 'Administrador',
              correo: email,
              isAdmin: true,
              provider: 'manual',
              fecha_registro: new Date().toISOString(),
              ultimo_acceso: new Date().toISOString(),
          };
          
          // Importante: desactivamos temporalmente las redirecciones automáticas 
          // para evitar conflictos durante el cambio de estado
          setLoading(true);
          
          // Primero guardar en localStorage para persistencia
          localStorage.setItem('userData', JSON.stringify(adminUser));
          
          // Actualizamos el estado en un orden específico para minimizar renderizados
          setIsAdmin(true);
          setUser(adminUser);
          
          // Re-habilitamos las redirecciones después de un pequeño delay
          // esto es crítico para evitar redirecciones prematuras
          setTimeout(() => {
            setLoading(false);
            console.log("AuthProvider - Admin autenticado correctamente, estado actualizado");
          }, 50);
          
          return adminUser; // Retornamos el usuario para indicar éxito
      }
      
      // Aquí se podría agregar la lógica para verificar en Firebase si el email está registrado como admin
      console.log("AuthProvider - Credenciales de administrador inválidas");
      throw new Error('Credenciales de administrador inválidas.');
    } catch (error) {
      console.error("AuthProvider - Error en login admin:", error);
      throw error;
    }
  };
  
  const handleLoginWithMatricula = async (matriculaInput: string, password: string) => {
    // Student password login
    const userRef = ref(db, `alumno/${matriculaInput}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
        throw new Error('Matrícula no encontrada.');
    }

    const dbUser = snapshot.val();
    if (dbUser.provider !== 'password') {
        throw new Error(`Esta cuenta fue registrada con Microsoft. Por favor, inicia sesión con ese método.`);
    }

    const { user: fbUser } = await signInWithEmailAndPassword(auth, dbUser.correo, password).catch(() => {
        throw new Error("Contraseña incorrecta.");
    });
    
    await handleUserSession(fbUser);
    router.push('/dashboard');
  };

  const handleRegister = async (userData: any) => {
    const methods = await fetchSignInMethodsForEmail(auth, userData.correo);
    if (methods.length > 0) {
        throw new Error('Este correo ya está registrado.');
    }

    const matriculaSnapshot = await get(ref(db, `alumno/${userData.matricula}`));
    if (matriculaSnapshot.exists()) {
        throw new Error('Esta matrícula ya está registrada.');
    }

    const { user: fbUser } = await createUserWithEmailAndPassword(auth, userData.correo, userData.password);

    const displayName = `${userData.nombre} ${userData.apellido_p} ${userData.apellido_m}`;
    await updateProfile(fbUser, { displayName });


    const newUser: Omit<User, 'isAdmin'> = {
        uid: fbUser.uid,
        matricula: userData.matricula,
        nombre: userData.nombre,
        apellido_p: userData.apellido_p,
        apellido_m: userData.apellido_m,
        carrera: userData.carrera,
        correo: userData.correo,
        chatbotName: userData.chatbotName,
        photoURL: fbUser.photoURL || null,
        provider: 'password',
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
    };
    
    await set(ref(db, `alumno/${userData.matricula}`), newUser);
    router.push('/login');
    return fbUser;
  };

  const signOut = async () => {
    const manualUserData = localStorage.getItem('userData');
    if (manualUserData) {
        const manualUser = JSON.parse(manualUserData);
        if (manualUser.provider === 'manual') {
            cleanupAuthState();
            router.push('/');
            return;
        }
    }
    await firebaseSignOut(auth);
    cleanupAuthState();
    router.push('/');
  };

  const updateUserProfile = async (profileData: { photoURL?: string | null }) => {
    if (!firebaseUser) return;
    
    try {
      await updateProfile(firebaseUser, profileData);
      
      if (user && user.matricula) {
        const userRef = ref(db, `alumno/${user.matricula}`);
        await update(userRef, { photoURL: profileData.photoURL });
        
        setUser({
          ...user,
          photoURL: profileData.photoURL || null
        });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    isAdmin,
    handleMicrosoftSignIn,
    handleLoginWithMatricula,
    handleAdminLogin,
    handleRegister,
    signOut,
    setUser,
    updateUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
