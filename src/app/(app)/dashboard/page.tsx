import { ChatWindow } from '@/components/chat/ChatWindow';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline">Asistente de Préstamos</CardTitle>
            <CardDescription>
              Usa el chat para solicitar materiales, consultar tu historial y más.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChatWindow />
        </CardContent>
      </Card>
    </div>
  );
}
