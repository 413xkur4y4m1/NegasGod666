
'use server';

import { dashboardStatisticsFlow } from '@/ai/flows/dashboard-statistics';

export async function getDashboardStatsAction() {
  try {
    console.log('[getDashboardStatsAction] Invocando el flujo de estadísticas...');
    const result = await dashboardStatisticsFlow(null);
    console.log('[getDashboardStatsAction] Flujo completado. Devolviendo datos.');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getDashboardStatsAction] Error al obtener estadísticas del dashboard:', error);
    return {
      success: false,
      error: 'No se pudieron cargar las estadísticas. Inténtalo de nuevo.',
    };
  }
}
