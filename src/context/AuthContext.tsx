
"use client";
import { createContext } from 'react';
import type { User } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  handleMicrosoftSignIn: () => Promise<any>;
  handleLoginWithMatricula: (matricula: string, password: string) => Promise<void>;
  handleRegister: (userData: any) => Promise<any>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
