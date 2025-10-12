'use client';

import { useState, useEffect } from 'react'; // <--- Añadido useEffect
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MicrosoftSignInButton } from '@/components/auth/MicrosoftSignInButton';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';

const createFormSchema = (role: 'student' | 'admin') =>
  z.object({
    identifier: z.string().min(1, {
      message: role === 'student' ? 'La matrícula es requerida.' : 'El correo es requerido.',
    }),
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  });

export default function LoginPage() {
  const { handleLoginWithMatricula, handleAdminLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<'student' | 'admin'>('student');

  const formSchema = createFormSchema(role);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // CORREGIDO: Usar useEffect para reaccionar a cambios en `role`
  useEffect(() => {
    form.reset({ identifier: '', password: '' });
  }, [role, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      if (role === 'admin') {
        await handleAdminLogin(values.identifier, values.password);
      } else {
        await handleLoginWithMatricula(values.identifier, values.password);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: error.message || 'Las credenciales son incorrectas.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Logo className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-headline">LaSalle Gestiona</CardTitle>
        <CardDescription>
          {role === 'student'
            ? 'Inicia sesión para gestionar tus préstamos.'
            : 'Portal de acceso administrativo.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              variant={role === 'student' ? 'default' : 'outline'}
              onClick={() => setRole('student')}
              className={cn(
                'transition-all duration-200',
                role === 'student' && 'ring-2 ring-primary ring-offset-2'
              )}
            >
              Soy Estudiante
            </Button>
            <Button
              variant={role === 'admin' ? 'default' : 'outline'}
              onClick={() => setRole('admin')}
              className={cn(
                'transition-all duration-200',
                role === 'admin' && 'ring-2 ring-primary ring-offset-2'
              )}
            >
              Soy Administrador
            </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {role === 'student' ? 'Matrícula' : 'Cuenta de Administrador'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        role === 'student'
                          ? 'Tu matrícula'
                          : 'admin@lasalle.edu.mx'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
          </form>
        </Form>
        
        {role === 'student' && (
            <>
                <Separator className="my-6" />
                <div className="space-y-4">
                    <MicrosoftSignInButton />
                </div>
            </>
        )}

      </CardContent>
      <CardFooter className="flex flex-col gap-2 items-center text-sm">
        <p>
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
