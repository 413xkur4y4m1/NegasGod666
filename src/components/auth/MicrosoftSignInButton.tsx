'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function MicrosoftSignInButton() {
  const { handleMicrosoftSignIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await handleMicrosoftSignIn();
      // The AuthProvider will handle redirection
    } catch (error: any) {
      console.error('Microsoft Sign In Error:', error);
      let description = 'No se pudo iniciar sesión con Microsoft.';
      if (error.code === 'auth/account-exists-with-different-credential') {
        description = 'Ya existe una cuenta con este correo electrónico pero con un método de inicio de sesión diferente.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        description = 'El proceso de inicio de sesión fue cancelado.'
      }
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: error.message || description,
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MicrosoftIcon className="mr-2 h-5 w-5" />
      )}
      Continuar con Microsoft
    </Button>
  );
}

function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 21 21" {...props}>
      <title>Microsoft</title>
      <path
        fill="#f25022"
        d="M1 1h9v9H1z"
        transform="translate(0 0)"
      ></path>
      <path
        fill="#00a4ef"
        d="M1 1h9v9H1z"
        transform="translate(0 10)"
      ></path>
      <path
        fill="#7fba00"
        d="M1 1h9v9H1z"
        transform="translate(10 0)"
      ></path>
      <path
        fill="#ffb900"
        d="M1 1h9v9H1z"
        transform="translate(10 10)"
      ></path>
    </svg>
  );
}
