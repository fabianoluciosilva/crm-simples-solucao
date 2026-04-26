import React from "react";

interface HeaderProps {
  setMenuMobileAberto: (val: boolean) => void;
  aba: string;
  carregando: boolean;
  filtroDias: number;
  setFiltroDias: (val: number) => void;
  vistaPropostas: string;
  setVistaPropostas: (val: any) => void;
  carregarTudo: () => void;
  alertasCount?: number; // Nova prop
}

export const Header = ({
  setMenuMobileAberto, aba, carregando, filtroDias, setFiltroDias,
  vistaPropostas, setVistaPropostas, carregarTudo, alertasCount = 0
}: HeaderProps) => {
  const tituloAba = () => {
    switch(aba) {
      case 'dashboard': return '📈 Dashboard';
      case 'propostas': return '🎯 Funil de Vendas';
      case 'clientes': return '👥 Base de Clientes';
      case 'contratos': return '📄 Financeiro (MRR)';
      case 'tarefas': return '✅ Tarefas';
      case 'relatorios': return '📊 Relatórios';
      case 'templates': return '📝 Templates';
      case 'usuarios': return '🔐 Usuários';
      default: return '';
    }
  };

  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button className="mobile-menu-btn" onClick={() => setMenuMobileAberto(true)}>☰</button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800 }}>{tituloAba()}</h1>
          {carregando && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>Sincronizando...</div>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        {/* Central de Alertas */}
        <div style={{ position: "relative", cursor: "pointer", padding: "8px", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border-light)" }} title="Alertas de atenção">
          <span>🔔</span>
          {alertasCount > 0 && (
            <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#f87171", color: "white", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "10px", border: "2px solid var(--bg-main)" }}>
              {alertasCount}
            </span>
          )}
        </div>

        <div className="header-controls" style={{ display: "flex", gap: "10px" }}>
          {(aba === 'dashboard' || aba === 'propostas' || aba === 'relatorios') && (
            <select value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "8px 12px", fontSize: 13 }}>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>3 Meses</option>
              <option value={0}>Sempre</option>
            </select>
          )}
          {aba === 'propostas' && (
            <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, overflow: "hidden" }}>
              <button onClick={() => setVistaPropostas('kanban')} style={{ background: vistaPropostas === 'kanban' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'kanban' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Kanban</button>
              <button onClick={() => setVistaPropostas('tabela')} style={{ background: vistaPropostas === 'tabela' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'tabela' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Tabela</button>
            </div>
          )}
          <button onClick={carregarTudo} className="btn-action" style={{ margin: 0 }}>🔄</button>
        </div>
      </div>
    </header>
  );
};