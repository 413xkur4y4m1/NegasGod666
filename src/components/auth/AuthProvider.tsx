'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser, signInWithPopup, OAuthProvider, createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // User is signed in with Firebase Auth (e.g., Microsoft)
        await handleUserSession(fbUser);
      } else {
        // No Firebase user, check for manual login in localStorage
        const manualUser = loadManualAuthState();
        if (manualUser) {
            setUser(manualUser);
            setIsAdmin(manualUser.isAdmin);
        } else {
            setUser(null);
            setIsAdmin(false);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
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

  const loadManualAuthState = (): User | null => {
    try {
        const userData = localStorage.getItem('userData');
        if (userData) {
            return JSON.parse(userData);
        }
    } catch (e) {
        console.error("Error loading manual auth state", e);
        cleanupAuthState();
    }
    return null;
  }
  
  const cleanupAuthState = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('userData');
  }

  const handleUserSession = async (fbUser: FirebaseUser) => {
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
        photoURL: fbUser.photoURL || dbUser.photoURL,
      };
      await update(userRef, updates);
      appUser = { ...dbUser, ...updates, isAdmin: userIsAdmin, uid: fbUser.uid };
    } else {
      // Create new user
      appUser = {
        uid: fbUser.uid,
        matricula,
        nombre: fbUser.displayName || 'Nuevo Usuario',
        correo: fbUser.email!,
        isAdmin: userIsAdmin,
        provider: (fbUser.providerData[0]?.providerId as 'microsoft.com') || 'password',
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
        photoURL: fbUser.photoURL || null,
      };
      await set(userRef, appUser);
    }
    
    // Store in our state
    setUser(appUser);
    setIsAdmin(userIsAdmin);
    // Also store in local storage for consistency if needed
    localStorage.setItem('userData', JSON.stringify(appUser));
  };
  
  const handleMicrosoftSignIn = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({
        tenant: 'common',
        prompt: 'select_account',
    });
    const result = await signInWithPopup(auth, provider);
    await handleUserSession(result.user);
    router.push(adminEmails.includes(result.user.email || '') ? '/admin' : '/dashboard');
    return result;
  };
  
  const adminEmails = ['admin@lasalle.edu.mx'];

  const handleLoginWithMatricula = async (matricula: string, password: string) => {
    // Admin login
    if (matricula === 'admin@lasalle.edu.mx' && password === 'admin123') {
        const adminUser: User = {
            uid: 'admin',
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

    // Student login
    const userRef = ref(db, `alumno/${matricula}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
        throw new Error('Matrícula no encontrada.');
    }

    const dbUser = snapshot.val();
    if (dbUser.provider !== 'password') {
        throw new Error(`Esta cuenta está registrada con ${dbUser.provider}. Por favor, inicia sesión con ese método.`);
    }

    // This is not secure, but mimics the user's provided JS.
    // Firebase Auth should be used for password auth.
    // This is a temporary solution based on the request.
    const { user: fbUser } = await auth.signInWithEmailAndPassword(dbUser.correo, password).catch(() => {
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

    const newUser: Partial<User> = {
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
        isAdmin: false,
        fecha_registro: new Date().toISOString(),
        ultimo_acceso: new Date().toISOString(),
    };
    
    await set(ref(db, `alumno/${userData.matricula}`), newUser);
    router.push('/login');
    return fbUser;
  };

  const signOut = async () => {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
