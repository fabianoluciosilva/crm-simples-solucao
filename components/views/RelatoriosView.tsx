import React from "react";
import {
  Tooltip as ChartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line
} from 'recharts';
import { MetricCard } from "@/components/MetricCard";
import { fmt } from "@/utils/crmLogic";

interface RelatoriosViewProps {
  clientesAgrupados: any[];
  contratos: any[];
  mrrAtivo: number;
  ticketMedio: number;
  dadosPipelineMensal: any[];
}

export const RelatoriosView = ({
  clientesAgrupados, contratos, mrrAtivo, ticketMedio, dadosPipelineMensal
}: RelatoriosViewProps) => {
  return (
    <>
      <div className="grid-metrics" style={{ marginBottom: 24 }}>
        <MetricCard label="CLIENTES ATIVOS" value={clientesAgrupados.filter(c => c.tipo === 'Cliente' && c.ativo !== false).length} icon="👥" />
        <MetricCard label="LEADS NA BASE" value={clientesAgrupados.filter(c => c.tipo === 'Lead').length} color="#f59e0b" icon="🎯" />
        <MetricCard label="CONTRATOS ATIVOS" value={contratos.filter(c => c.status === 'Ativo').length} color="#22c55e" icon="📄" />
        <MetricCard label="CHURN (CANCELADOS)" value={contratos.filter(c => c.status === 'Cancelado').length} color="#f87171" icon="📉" />
        <MetricCard label="MRR TOTAL" value={fmt(mrrAtivo)} color="#22c55e" icon="💰" />
        <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} icon="🎟️" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        <div className="metric-card" style={{ height: 360 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: 8 }}>MRR Atual vs Meta Trimestral</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 16 }}>Valor recorrente por contratos ativos</div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={[{ name: 'MRR Atual', Receita: mrrAtivo }, { name: 'Meta (+20%)', Receita: mrrAtivo * 1.2 }]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v: any) => fmt(v)} />
              <Bar dataKey="Receita" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="metric-card" style={{ height: 360 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: 8 }}>Evolução Mensal de Propostas</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 16 }}>Ganhas vs Perdidas nos últimos 6 meses</div>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={dadosPipelineMensal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ganhas" name="Ganhas" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
              <Line type="monotone" dataKey="perdidas" name="Perdidas" stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};
