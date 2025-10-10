
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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

const formSchema = z.object({
  matricula: z.string().min(1, { message: 'La matrícula es requerida.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

export default function LoginPage() {
  const { handleLoginWithMatricula } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      matricula: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await handleLoginWithMatricula(values.matricula, values.password);
      // AuthProvider handles redirection
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: error.message || 'Matrícula o contraseña incorrectos.',
      });
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
          Inicia sesión para gestionar tus préstamos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="matricula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matrícula</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu matrícula" {...field} />
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
        <Separator className="my-6" />
        <div className="space-y-4">
          <MicrosoftSignInButton />
        </div>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
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
