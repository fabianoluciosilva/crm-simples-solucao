import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { MetricCard } from '../ui/MetricCard';

const COLORS_PIE = ['#f87171', '#f59e0b', '#4A90D9', '#a855f7', '#64748b'];

export function DashboardTab({
  isAdmin, mrrAtivo, taxaConversao, propostasFechadas, ticketMedio,
  propostasPerdidas, propostasAbertas, propostasEnviadas, tarefasUrgentes,
  pFiltradas, dadosMotivosPerda, dadosPipelineMensal, fmt, setAba, contratos
}: any) {
  return (
    <>
      <div className="grid-metrics">
        {isAdmin && <MetricCard label="MRR ATIVO" value={fmt(mrrAtivo)} borderColor="#22c55e" icon="💰" sub={`${contratos.filter((c:any) => c.status === 'Ativo').length} contratos`} />}
        <MetricCard label="TAXA DE CONVERSÃO" value={`${taxaConversao.toFixed(1)}%`} color="#4A90D9" borderColor="#4A90D9" icon="📈" />
        <MetricCard label="GANHAS (VALOR)" value={fmt(propostasFechadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" icon="🏆" sub={`${propostasFechadas.length} negócios`} />
        <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} borderColor="#a855f7" icon="🎟️" />
        <MetricCard label="PERDIDAS" value={propostasPerdidas.length} color="#f87171" borderColor="#f87171" icon="❌" />
      </div>

      <div className="grid-metrics" style={{ marginBottom: "24px" }}>
        <MetricCard label="EM ABERTO (NOVAS)" value={fmt(propostasAbertas.reduce((a:any, b:any) => a + b.valor, 0))} borderColor="#64748b" />
        <MetricCard label="EM NEGOCIAÇÃO" value={fmt(propostasEnviadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#4A90D9" borderColor="#4A90D9" />
        <MetricCard label="FECHADO NO PERÍODO" value={fmt(propostasFechadas.reduce((a:any, b:any) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" />
      </div>

      {tarefasUrgentes.length > 0 && (
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>⚠️ {tarefasUrgentes.length} tarefa{tarefasUrgentes.length > 1 ? 's' : ''} urgente{tarefasUrgentes.length > 1 ? 's' : ''}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13, marginLeft: 10 }}>{tarefasUrgentes.slice(0, 2).map((t:any) => t.titulo).join(', ')}{tarefasUrgentes.length > 2 ? '...' : ''}</span>
          </div>
          <button className="btn-action" style={{ color: "#f87171", borderColor: "#f87171" }} onClick={() => setAba('tarefas')}>Ver Tarefas</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
        <div className="metric-card" style={{ height: 320 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📊 Funil de Negociação</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: 'Criadas', qtd: pFiltradas.length }, { name: 'Enviadas', qtd: propostasEnviadas.length + propostasFechadas.length }, { name: 'Ganhas', qtd: propostasFechadas.length }]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={80} />
              <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Bar dataKey="qtd" fill="#4A90D9" radius={[0, 6, 6, 0]} barSize={28} label={{ position: 'right', fill: 'var(--text-primary)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" style={{ height: 320 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📉 Motivos de Perda</div>
          {propostasPerdidas.length === 0 ? (
            <div style={{ height: "80%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 32 }}>🎉</span>
              <span>Nenhuma perda no período!</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dadosMotivosPerda} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value">
                  {dadosMotivosPerda.map((entry:any, index:number) => <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />)}
                </Pie>
                <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="metric-card" style={{ height: 280, gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📅 Evolução Mensal de Propostas (6 meses)</div>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={dadosPipelineMensal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorGanhas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPerdidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Area type="monotone" dataKey="ganhas" name="Ganhas" stroke="#22c55e" fill="url(#colorGanhas)" strokeWidth={2} />
              <Area type="monotone" dataKey="perdidas" name="Perdidas" stroke="#f87171" fill="url(#colorPerdidas)" strokeWidth={2} />
              <Area type="monotone" dataKey="abertas" name="Em Aberto" stroke="#4A90D9" fill="none" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
