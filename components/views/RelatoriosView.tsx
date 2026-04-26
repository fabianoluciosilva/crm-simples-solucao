import React, { useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, Cell, PieChart, Pie 
} from 'recharts';
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

  // Cálculo de Saúde da Base
  const statsFinanceiras = useMemo(() => {
    const totalContratos = contratos.filter(c => c.status === 'Ativo').length;
    const mrrTotal = contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    const tMedio = totalContratos > 0 ? mrrTotal / totalContratos : 0;
    
    // Simulação de Churn (Contratos cancelados nos últimos 30 dias)
    const contratosCancelados = contratos.filter(c => c.status === 'Cancelado').length;

    return { totalContratos, mrrTotal, tMedio, contratosCancelados };
  }, [contratos]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Cards de Métricas Financeiras */}
      <div className="grid-metrics">
        <div className="metric-card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Recorrência Mensal (MRR)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{fmt(statsFinanceiras.mrrTotal)}</div>
          <div style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>💳 Base Ativa</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Ticket Médio Mensal</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#4A90D9" }}>{fmt(statsFinanceiras.tMedio)}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>por contrato</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Contratos Ativos</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{statsFinanceiras.totalContratos}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Empresas</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Churn (Cancelados)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f87171" }}>{statsFinanceiras.contratosCancelados}</div>
          <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>Total histórico</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        
        {/* Gráfico de Evolução (Pipeline) */}
        <div className="metric-card" style={{ minHeight: "350px" }}>
          <h3 style={{ fontSize: 16, marginBottom: 20 }}>Evolução de Vendas (Últimos 6 Meses)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dadosPipelineMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} />
              <Tooltip 
                contentStyle={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-light)", borderRadius: 8 }}
                itemStyle={{ fontSize: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar dataKey="ganhas" name="Ganhas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="perdidas" name="Perdidas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição por Tipo de Cliente */}
        <div className="metric-card" style={{ minHeight: "350px" }}>
          <h3 style={{ fontSize: 16, marginBottom: 20 }}>Composição da Base</h3>
          <div style={{ display: "flex", alignItems: "center", height: "250px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Contratos TI', value: statsFinanceiras.totalContratos },
                    { name: 'Leads em Aberto', value: clientesAgrupados.filter(c => c.tipo === 'Lead').length }
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#4A90D9" />
                  <Cell fill="rgba(255,255,255,0.1)" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};