'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import { logger } from '@/lib/logger';
import { saveFile } from '@/lib/file-storage';

export function ProfilePhotoUpload() {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const compressImage = async (file: File) => {
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 500,
        useWebWorker: true
      };
      
      return await imageCompression(file, options);
    } catch (error) {
      logger.error('student', 'image-compression', error, user?.uid);
      throw new Error('Error al comprimir la imagen');
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecciona una imagen válida');
      }

      // Comprimir imagen
      const compressedFile = await compressImage(file);
      
      // Guardar el archivo localmente
      const { url } = await saveFile(compressedFile, `${user.uid}-${compressedFile.name}`);
      setUploadProgress(100);
      
      // Actualizar perfil con la URL local
      await updateUserProfile({ photoURL: url });
      
      logger.chatbot('student', 'photo-upload-success', {
        userId: user.uid,
        fileSize: compressedFile.size
      });

      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido actualizada exitosamente."
      });
    } catch (error) {
      logger.error('student', 'photo-upload-error', error, user?.uid);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la foto. Intenta de nuevo."
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={user?.photoURL || ''} alt={user?.nombre || 'Profile'} />
        <AvatarFallback>{user?.nombre?.[0] || 'U'}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-center gap-2">
        <Button
          variant="outline"
          disabled={isUploading}
          onClick={() => document.getElementById('photo-upload')?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subiendo... {uploadProgress}%
            </>
          ) : (
            'Cambiar foto'
          )}
        </Button>
        
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
          disabled={isUploading}
        />
        
        {user?.photoURL && !isUploading && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              try {
                await updateUserProfile({ photoURL: null });
                toast({
                  title: "Foto eliminada",
                  description: "Tu foto de perfil ha sido eliminada."
                });
              } catch (error) {
                logger.error('student', 'photo-delete-error', error, user?.uid);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "No se pudo eliminar la foto. Intenta de nuevo."
                });
              }
            }}
          >
            Eliminar foto
          </Button>
        )}
      </div>
    </div>
  );
}