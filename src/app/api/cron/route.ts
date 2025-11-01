
import { NextResponse } from 'next/server';
import { automatedLoanSupervisor } from '@/ai/flows/automated-loan-supervisor';

export async function GET(request: Request) {
  // IMPORTANT: This is a basic security measure. 
  // In a real production environment, you should use a more robust secret management strategy.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // CORREGIDO: El nombre del flujo importado es 'automatedLoanSupervisor'
    const result = await automatedLoanSupervisor();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ success: false, message: errorMessage }), { status: 500 });
  }
}
