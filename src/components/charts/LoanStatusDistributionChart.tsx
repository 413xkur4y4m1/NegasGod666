'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartProps {
  data: { name: string; value: number }[];
}

// Paleta de colores para los estados de los préstamos
const COLORS = {
  devuelto: 'hsl(var(--chart-1))',  // Verde/Azul suave
  activo: 'hsl(var(--chart-2))', // Azul primario
  vencido: 'hsl(var(--chart-3))', // Naranja/Amarillo
  pendiente: 'hsl(var(--chart-4))', // Amarillo/Ambar
  perdido: 'hsl(var(--chart-5))', // Rojo
};

// Capitaliza la primera letra de una cadena
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function LoanStatusDistributionChart({ data }: ChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground p-4">No hay datos para mostrar la distribución.</div>;
  }

  const chartData = data.map(item => ({ ...item, name: capitalize(item.name) }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Tooltip
          cursor={{fill: 'hsl(var(--muted))'}}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--popover-foreground))',
            borderRadius: '0.5rem'
          }}
          formatter={(value: number, name: string) => [value, `${name}`]}
        />
        <Legend 
          verticalAlign="bottom" 
          align="center" 
          iconSize={10} 
          wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
        />
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={110}
          fill="#8884d8"
          dataKey="value"
          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return (
              <text x={x} y={y} fill="hsl(var(--primary-foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
              </text>
            );
          }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || '#8884d8'} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
