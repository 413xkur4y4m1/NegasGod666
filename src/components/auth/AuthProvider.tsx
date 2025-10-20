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
    const userRef = ref(db, `alumnos/${matricula}`); // FIX: Changed to 'alumnos'
    const snapshot = await get(userRef);

    let appUser: User;

    if (snapshot.exists()) {
      const dbUser = snapshot.val();
      const updates = {
        ultimoAcceso: new Date().toISOString(),
        nombre: fbUser.displayName || dbUser.nombre,
        photoURL: fbUser.photoURL || dbUser.photoURL || null,
      };
      await update(userRef, updates);
      appUser = { ...dbUser, ...updates, isAdmin: userIsAdmin, uid: fbUser.uid };
    } else {
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
        fechaRegistro: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString(),
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
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
          try {
            const storedUser = JSON.parse(storedUserData);
            if (storedUser.provider === 'manual' && storedUser.isAdmin) {
              setUser(storedUser);
              setIsAdmin(true);
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
    if (loading) return; // No hacer nada mientras se carga

    const isAuthPage = pathname === '/login' || pathname === '/signup';

    // Si el usuario está autenticado
    if (user) {
      // Si está en una página de autenticación o en la raíz, redirigir al panel correspondiente
      if (isAuthPage || pathname === '/') {
        router.replace(user.isAdmin ? '/admin' : '/dashboard');
      }
    } 
    // Si el usuario NO está autenticado
    else {
      // Y está intentando acceder a una ruta protegida
      const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/profile');
      if (isProtectedRoute) {
        // Redirigirlo a la página de login unificada
        router.replace('/login');
      }
    }
  }, [user, loading, pathname, router]);
  
  const handleMicrosoftSignIn = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ tenant: 'common', prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      await handleUserSession(result.user);
      // La redirección se gestiona en el useEffect principal
    } catch(error: any) {
        let description = 'No se pudo iniciar sesión con Microsoft.';
        if (error.code === 'auth/account-exists-with-different-credential') {
          description = 'Ya existe una cuenta con este correo. Intenta iniciar sesión con el otro método.';
        } else if (error.code === 'auth/popup-closed-by-user') {
          description = 'El proceso de inicio de sesión fue cancelado.'
        }
        throw new Error(description);
    }
  };
  
  const handleAdminLogin = async (email: string, password: string) => {
    if (email.toLowerCase() !== 'admin@lasalle.edu.mx' || password !== 'admin123') {
      throw new Error('Credenciales de administrador inválidas.');
    }

    const adminUser: User = {
        uid: 'admin-manual',
        matricula: 'admin',
        nombre: 'Administrador',
        apellido_p: '', // FIX
        apellido_m: '', // FIX
        correo: email,
        isAdmin: true,
        provider: 'manual',
        fechaRegistro: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString(),
    };
    
    localStorage.setItem('userData', JSON.stringify(adminUser));
    setUser(adminUser);
    setIsAdmin(true);
    // La redirección la maneja el useEffect principal
  };
  
  const handleLoginWithMatricula = async (matriculaInput: string, password: string) => {
    const userRef = ref(db, `alumnos/${matriculaInput}`); // FIX: Changed to 'alumnos'
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
    // La redirección la maneja el useEffect principal
  };

  const handleRegister = async (userData: any) => {
    const methods = await fetchSignInMethodsForEmail(auth, userData.correo);
    if (methods.length > 0) {
        throw new Error('Este correo ya está registrado.');
    }

    const matriculaSnapshot = await get(ref(db, `alumnos/${userData.matricula}`)); // FIX: Changed to 'alumnos'
    if (matriculaSnapshot.exists()) {
        throw new Error('Esta matrícula ya está registrada.');
    }

    const { user: fbUser } = await createUserWithEmailAndPassword(auth, userData.correo, userData.password);
    const displayName = `${userData.nombre} ${userData.apellido_p} ${userData.apellido_m}`;
    await updateProfile(fbUser, { displayName });

    const newUser: User = {
        uid: fbUser.uid,
        matricula: userData.matricula,
        nombre: userData.nombre,
        apellido_p: userData.apellido_p,
        apellido_m: userData.apellido_m,
        carrera: userData.carrera,
        correo: userData.correo, // FIX: Added missing 'correo' property
        isAdmin: false, // FIX: Explicitly set isAdmin to false
        chatbotName: userData.chatbotName,
        photoURL: fbUser.photoURL || null,
        provider: 'password',
        fechaRegistro: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString(),
    };
    
    await set(ref(db, `alumnos/${userData.matricula}`), newUser); // FIX: Changed to 'alumnos'
    router.push('/login');
    return fbUser;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error during Firebase sign out:", error);
    } finally {
      cleanupAuthState();
      router.push('/');
    }
  };

  const updateUserProfile = async (profileData: { photoURL?: string | null }) => {
    if (!firebaseUser) return;
    try {
      await updateProfile(firebaseUser, profileData);
      if (user && user.matricula) {
        const userRef = ref(db, `alumnos/${user.matricula}`); // FIX: Changed to 'alumnos'
        await update(userRef, { photoURL: profileData.photoURL });
        setUser({ ...user, photoURL: profileData.photoURL || null });
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
