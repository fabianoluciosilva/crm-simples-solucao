import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

// Pode mover o MetricCard para um ficheiro /components/ui/MetricCard.tsx
const MetricCard = ({ label, value, color, borderColor, icon, sub }: any) => (
  <div className="metric-card" style={{ borderTop: borderColor ? `3px solid ${borderColor}` : undefined }}>
    <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{label}
    </div>
    <div style={{ fontSize: "28px", fontWeight: 800, color: color || "var(--text-primary)", marginTop: 8 }}>{value}</div>
    {sub && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
  </div>
);

// O componente recebe os dados como "props" (parâmetros) do ficheiro principal
export function DashboardTab({ 
  isAdmin, 
  mrrAtivo, 
  taxaConversao, 
  propostasFechadas, 
  propostasPerdidas, 
  propostasAbertas, 
  propostasEnviadas, 
  pFiltradas, 
  dadosMotivosPerda, 
  dadosPipelineMensal, 
  fmt 
}: any) {
  
  const COLORS_PIE = ['#f87171', '#f59e0b', '#4A90D9', '#a855f7', '#64748b'];
  const ticketMedio = propostasFechadas.length > 0 ? propostasFechadas.reduce((a:any, b:any) => a + b.valor, 0) / propostasFechadas.length : 0;

  return (
    <>
      <div className="grid-metrics">
        {isAdmin && <MetricCard label="MRR ATIVO" value={fmt(mrrAtivo)} borderColor="#22c55e" icon="💰" />}
        <MetricCard label="TAXA DE CONVERSÃO" value={`${taxaConversao.toFixed(1)}%`} color="#4A90D9" borderColor="#4A90D9" icon="📈" />
        <MetricCard label="GANHAS (VALOR)" value={fmt(propostasFechadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" icon="🏆" />
        <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} borderColor="#a855f7" icon="🎟️" />
        <MetricCard label="PERDIDAS" value={propostasPerdidas.length} color="#f87171" borderColor="#f87171" icon="❌" />
      </div>

      <div className="grid-metrics" style={{ marginBottom: "24px" }}>
        <MetricCard label="EM ABERTO (NOVAS)" value={fmt(propostasAbertas.reduce((a:any, b:any) => a + b.valor, 0))} borderColor="#64748b" />
        <MetricCard label="EM NEGOCIAÇÃO" value={fmt(propostasEnviadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#4A90D9" borderColor="#4A90D9" />
        <MetricCard label="FECHADO NO PERÍODO" value={fmt(propostasFechadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" />
      </div>

      {/* Aqui entram os seus Gráficos (BarChart, PieChart, AreaChart) copiados exatamente como estavam */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
        {/* ... os gráficos ... */}
      </div>
    </>
  );
}
