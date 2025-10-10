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
    if (!loading) {
      if (user) {
        const publicRoutes = ['/login', '/signup', '/'];
        if (publicRoutes.includes(pathname)) {
          router.replace(user.isAdmin ? '/admin' : '/dashboard');
        }
      } else {
        const protectedRoutes = ['/dashboard', '/profile', '/admin'];
        if (protectedRoutes.some(p => pathname.startsWith(p))) {
          router.replace('/login');
        }
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
  
  const handleLoginWithMatricula = async (matricula: string, password: string) => {
    // Admin manual login
    if (matricula === 'admin@lasalle.edu.mx' && password === 'admin123') {
        const adminUser: User = {
            uid: 'admin-manual',
            matricula: 'admin',
            nombre: 'Administrador',
            correo: 'admin@lasalle.edu.mx',
            isAdmin: true,
            provider: 'manual',
            fecha_registro: new Date().toISOString(),
            ultimo_acceso: new Date().toISOString(),
        };
        setUser(adminUser);
        setIsAdmin(true);
        localStorage.setItem('userData', JSON.stringify(adminUser));
        router.push('/admin');
        return;
    }

    // Student password login
    const userRef = ref(db, `alumno/${matricula}`);
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

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    isAdmin,
    handleMicrosoftSignIn,
    handleLoginWithMatricula,
    handleRegister,
    signOut,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
