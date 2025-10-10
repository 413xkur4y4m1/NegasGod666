import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, BrainCircuit, GanttChartSquare, GraduationCap, Users } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <Logo className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold font-headline text-primary">
            LaSalle Gestiona
          </h1>
        </div>
        <nav className="flex items-center gap-4">
          <Button asChild variant="ghost">
            <Link href="/admin/login">Admin Login</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Acceso Estudiantes</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative w-full pt-20 pb-20 md:pt-32 md:pb-24 text-center bg-primary/5">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl font-extrabold tracking-tight font-headline text-primary sm:text-5xl md:text-6xl">
                Gestiona y Solicita Material con Inteligencia Artificial
              </h2>
              <p className="mt-6 text-lg text-foreground/80 max-w-2xl mx-auto">
                Una experiencia moderna para la comunidad de La Salle Neza. Pide prestado equipo de cocina y más, con la ayuda de tu asistente personal de IA.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">Crear Cuenta</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Iniciar Sesión</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold font-headline text-primary">
                Una Plataforma Revolucionaria
              </h3>
              <p className="mt-4 text-md text-foreground/70 max-w-2xl mx-auto">
                Diseñado para simplificar la vida académica, nuestro sistema integra tecnología de punta para una gestión de recursos sin precedentes.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Bot className="h-8 w-8 text-accent" />}
                title="Asistente Chatbot Personal"
                description="Cada estudiante tiene su propio asistente de IA. Pide materiales, consulta tu historial y recibe notificaciones, todo a través de una conversación natural."
              />
              <FeatureCard
                icon={<GanttChartSquare className="h-8 w-8 text-accent" />}
                title="Gestión de Préstamos Simplificada"
                description="Olvida los formularios. Simplemente dile a tu chatbot qué necesitas y cuándo lo devolverás. El sistema se encarga del resto."
              />
              <FeatureCard
                icon={<BrainCircuit className="h-8 w-8 text-accent" />}
                title="Búsqueda Inteligente de Materiales"
                description="¿No sabes el nombre exacto? Describe lo que buscas y nuestro sistema te mostrará opciones con imágenes generadas por IA para que identifiques el material correcto."
              />
              <FeatureCard
                icon={<GraduationCap className="h-8 w-8 text-accent" />}
                title="Para Estudiantes, Por Estudiantes"
                description="Accede desde cualquier lugar. La plataforma está diseñada pensando en tus necesidades, con una interfaz intuitiva y amigable."
              />
              <FeatureCard
                icon={<Users className="h-8 w-8 text-accent" />}
                title="Gestión Administrativa Potenciada"
                description="Los administradores cuentan con un asistente virtual para gestionar el inventario, supervisar préstamos y generar informes estadísticos avanzados."
              />
               <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-accent"><path d="M12 11V15"/><path d="M12 7.01V7.01"/></svg>}
                title="Disponibilidad Móvil"
                description="Descarga la versión móvil de la aplicación para una experiencia optimizada en tu dispositivo, llevando la gestión de préstamos contigo a donde vayas."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Universidad La Salle Nezahualcóyotl. Todos los derechos reservados.</p>
          <p className="mt-1">Un proyecto de la comunidad de Ingeniería.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center">
        <div className="bg-primary/10 p-3 rounded-full">
          {icon}
        </div>
        <CardTitle className="font-headline mt-4">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/70">{description}</p>
      </CardContent>
    </Card>
  );
}
