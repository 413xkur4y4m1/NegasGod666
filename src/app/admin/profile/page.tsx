// src/app/admin/profile/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";


export default function ProfilePage() {
  const { user, firebaseUser, setUser } = useAuth();
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL || null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    if (!name) return 'A';
    const names = name.split(' ');
    if (names.length > 1 && names[1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
        return;
    }

    setIsLoading(true);

    try {
        let photoURL = user.photoURL;

        if (newPhoto) {
            const storage = getStorage();
            const fileRef = storageRef(storage, `profile-photos/${user.uid}/${newPhoto.name}`);
            const snapshot = await uploadBytes(fileRef, newPhoto);
            photoURL = await getDownloadURL(snapshot.ref);
        }

        // Update Firebase Auth profile
        if (firebaseUser) {
            await updateProfile(firebaseUser, {
                photoURL: photoURL || null,
            });
        }
        

        // Update Realtime Database
        if(user.provider !== 'manual') {
            const userDbRef = ref(db, `alumno/${user.matricula}`);
            await update(userDbRef, {
                photoURL: photoURL || null,
            });
        }
        
        // Update local user state
        const updatedUser = { ...user, photoURL: photoURL };
        setUser(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));


        toast({ title: 'Perfil Actualizado', description: 'Tu foto de perfil ha sido actualizada.' });
        setNewPhoto(null);

    } catch (error) {
        console.error("Error updating profile:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el perfil.' });
    } finally {
        setIsLoading(false);
    }
  };

  if (!user) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Tu Perfil</CardTitle>
        <CardDescription>
          Aquí puedes ver y actualizar la información de tu perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage src={photoPreview || undefined} alt={user.nombre} />
            <AvatarFallback className="text-3xl">{getInitials(user.nombre)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <Label htmlFor="picture">Cambiar Foto de Perfil</Label>
            <Input id="picture" type="file" onChange={handlePhotoChange} accept="image/*" />
            <p className="text-xs text-muted-foreground">Sube una nueva imagen para tu perfil.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <Label>Nombre</Label>
                <Input value={`${user.nombre} ${user.apellido_p || ''} ${user.apellido_m || ''}`} disabled />
             </div>
             <div>
                <Label>Matrícula</Label>
                <Input value={user.matricula} disabled />
             </div>
             <div>
                <Label>Correo</Label>
                <Input value={user.correo} disabled />
             </div>
             <div>
                <Label>Carrera</Label>
                <Input value={user.carrera || 'No especificada'} disabled />
             </div>
        </div>
        
        <Button onClick={handleProfileUpdate} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : (
            'Guardar Cambios'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
