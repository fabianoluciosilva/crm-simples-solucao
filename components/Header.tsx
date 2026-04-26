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
}

export const Header = ({
  setMenuMobileAberto, aba, carregando, filtroDias, setFiltroDias,
  vistaPropostas, setVistaPropostas, carregarTudo
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
          {carregando && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>A sincronizar dados...</div>}
        </div>
      </div>
      <div className="header-controls">
        {(aba === 'dashboard' || aba === 'propostas' || aba === 'relatorios') && (
          <select value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "8px 12px", fontSize: 13 }}>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 3 Meses</option>
            <option value={180}>Últimos 6 Meses</option>
            <option value={0}>Sempre</option>
          </select>
        )}
        {aba === 'propostas' && (
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setVistaPropostas('kanban')} style={{ background: vistaPropostas === 'kanban' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'kanban' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Kanban</button>
            <button onClick={() => setVistaPropostas('tabela')} style={{ background: vistaPropostas === 'tabela' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'tabela' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Tabela</button>
          </div>
        )}
        <button onClick={carregarTudo} className="btn-action" style={{ margin: 0 }} title="Recarregar dados">🔄</button>
      </div>
    </header>
  );
};
