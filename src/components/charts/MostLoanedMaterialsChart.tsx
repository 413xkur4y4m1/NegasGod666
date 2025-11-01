'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartProps {
  data: { name: string; count: number }[];
}

export function MostLoanedMaterialsChart({ data }: ChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground p-4">No hay datos suficientes para mostrar esta gráfica.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 0,
          bottom: 75, // Aumentar el espacio inferior para las etiquetas
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="name" 
          angle={-60} 
          textAnchor="end" 
          interval={0} 
          height={10} // Altura del eje, no de las etiquetas
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          allowDecimals={false} 
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          cursor={{fill: 'hsl(var(--muted))'}}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--popover-foreground))',
            borderRadius: '0.5rem'
          }}
        />
        <Legend 
          verticalAlign="top" 
          align="right"
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
        <Bar dataKey="count" name="Nº de Préstamos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
