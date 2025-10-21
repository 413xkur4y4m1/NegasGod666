'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser, signInWithPopup, OAuthProvider, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

import { auth, db } from '@/lib/firebase';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { User, UserSchema } from '@/lib/types';

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
    const rawDbUser = snapshot.val();

    if (rawDbUser) {
      const updates = {
        ultimo_acceso: new Date().toISOString(),
        nombre: fbUser.displayName || rawDbUser.nombre,
        photoURL: fbUser.photoURL || rawDbUser.photoURL || null,
      };
      await update(userRef, updates);
      
      const updatedRawUser = { ...rawDbUser, ...updates, uid: fbUser.uid };
      const parsedUser = UserSchema.safeParse(updatedRawUser);

      if(parsedUser.success) {
        appUser = { ...parsedUser.data, isAdmin: userIsAdmin };
      } else {
        console.error("Error parsing user from DB:", parsedUser.error);
        cleanupAuthState();
        return;
      }
    } else {
      const names = fbUser.displayName?.split(' ') || ['Nuevo', 'Usuario'];
      const nombre = names.slice(0, -2).join(' ') || names[0];
      const apellidoP = names.length > 2 ? names[names.length-2] : names[1] || '';
      const apellidoM = names.length > 2 ? names[names.length-1] : '';

      const rawNewUser = {
        uid: fbUser.uid,
        matricula,
        nombre: nombre,
        apellido_p: apellidoP,
        apellido_m: apellidoM,
        correo: fbUser.email!,
        isAdmin: userIsAdmin,
        provider: (fbUser.providerData[0]?.providerId as 'microsoft.com') || 'password',
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
        photoURL: fbUser.photoURL || null,
        chatbot_name: nombre.split(' ')[0], // Add default chatbot name
      };
      await set(userRef, rawNewUser);
      const parsedUser = UserSchema.safeParse(rawNewUser);
      if(parsedUser.success) {
        appUser = parsedUser.data;
      } else {
        console.error("Error parsing new user:", parsedUser.error);
        cleanupAuthState();
        return;
      }
    }
    
    setUser(appUser);
    setIsAdmin(appUser.isAdmin);
    localStorage.setItem('userData', JSON.stringify(appUser));
  }, [cleanupAuthState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        await handleUserSession(fbUser);
      } else {
        cleanupAuthState();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [handleUserSession, cleanupAuthState]);
  
  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === '/login' || pathname === '/signup';

    if (user) {
      if (isAuthPage || pathname === '/') {
        router.replace(user.isAdmin ? '/admin' : '/dashboard');
      }
    } else {
      const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/profile');
      if (isProtectedRoute) {
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
        apellidoP: '',
        apellidoM: '',
        correo: email,
        isAdmin: true,
        provider: 'manual',
        fechaRegistro: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString(),
        carrera: undefined,
        photoURL: null,
        chatbotName: 'Admin',
    };
    
    localStorage.setItem('userData', JSON.stringify(adminUser));
    setUser(adminUser);
    setIsAdmin(true);
  };
  
  const handleLoginWithMatricula = async (matriculaInput: string, password: string) => {
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
    // CORRECTED: Read snake_case from form data, but construct displayName with camelCase logic for consistency.
    const displayName = `${userData.nombre} ${userData.apellido_p} ${userData.apellido_m}`;
    await updateProfile(fbUser, { displayName });

    const rawNewUser = {
        uid: fbUser.uid,
        matricula: userData.matricula,
        nombre: userData.nombre,
        apellido_p: userData.apellido_p, 
        apellido_m: userData.apellido_m,
        carrera: userData.carrera,
        correo: userData.correo,
        isAdmin: false,
        chatbot_name: userData.chatbotName,
        photoURL: fbUser.photoURL || null,
        provider: 'password', 
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
    };
    
    await set(ref(db, `alumno/${userData.matricula}`), rawNewUser);
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
        const userRef = ref(db, `alumno/${user.matricula}`);
        await update(userRef, { photoURL: profileData.photoURL });
        const updatedUser = { ...user, photoURL: profileData.photoURL || null };
        setUser(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
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
