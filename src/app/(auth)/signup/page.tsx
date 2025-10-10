'use client';

import { useState, useRef } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { SimpleCaptcha } from '@/components/auth/SimpleCaptcha';

const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido.'),
  apellido_p: z.string().min(1, 'El apellido paterno es requerido.'),
  apellido_m: z.string().min(1, 'El apellido materno es requerido.'),
  matricula: z.string().min(1, 'La matrícula es requerida.'),
  correo: z.string().email('Correo electrónico inválido.').includes('@ulsaneza.edu.mx', { message: "Debe ser un correo institucional de @ulsaneza.edu.mx" }),
  carrera: z.string().min(1, 'La carrera es requerida.'),
  chatbotName: z.string().min(1, 'El nombre para tu chatbot es requerido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  captcha: z.string(),
});

export default function SignUpPage() {
  const { handleRegister } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const captchaRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: '',
      apellido_p: '',
      apellido_m: '',
      matricula: '',
      correo: '',
      carrera: '',
      chatbotName: '',
      password: '',
      captcha: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isCaptchaVerified) {
      toast({
        variant: 'destructive',
        title: 'Verificación fallida',
        description: 'Por favor, resuelve el captcha correctamente.',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const userData = { ...values };
      delete (userData as any).captcha; // Don't send captcha to backend

      await handleRegister(userData);
      toast({
        title: 'Registro exitoso',
        description: '¡Bienvenido! Ahora puedes iniciar sesión.',
      });
      // AuthProvider will redirect to login page or dashboard after registration logic
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: error.message || 'No se pudo completar el registro.',
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
        <CardTitle className="text-2xl font-headline">Crear Cuenta de Estudiante</CardTitle>
        <CardDescription>
          Únete a LaSalle Gestiona para simplificar tus préstamos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre(s)</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input placeholder="244000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="apellido_p"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido Paterno</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu apellido" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apellido_m"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido Materno</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu apellido" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="correo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Institucional</FormLabel>
                  <FormControl>
                    <Input placeholder="tu-matricula@ulsaneza.edu.mx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="carrera"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Carrera</FormLabel>
                    <FormControl>
                        <Input placeholder="Ej. ISCC" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="chatbotName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre para tu Chatbot</FormLabel>
                    <FormControl>
                        <Input placeholder="Ej. Jarvis" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Crea una contraseña segura" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="captcha"
              render={({ field }) => (
                <FormItem>
                  <SimpleCaptcha onVerify={setIsCaptchaVerified} ref={captchaRef} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading || !isCaptchaVerified}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrarse
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
