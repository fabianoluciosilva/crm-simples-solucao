"use client";

interface HeaderProps {
  aba: string;
  carregando: boolean;
  filtroDias: number;
  setFiltroDias: (dias: number) => void;
  vistaPropostas: string;
  setVistaPropostas: (vista: any) => void;
  carregarTudo: () => void;
}

export function Header({
  aba, carregando, filtroDias, setFiltroDias,
  vistaPropostas, setVistaPropostas, carregarTudo
}: HeaderProps) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800 }}>
          {aba === 'dashboard' && '📈 Dashboard'}
          {aba === 'propostas' && '🎯 Funil de Vendas'}
          {aba === 'clientes' && '👥 Base de Clientes'}
          {aba === 'contratos' && '📄 Financeiro (MRR)'}
          {aba === 'tarefas' && '✅ Tarefas'}
          {aba === 'relatorios' && '📊 Relatórios'}
          {aba === 'templates' && '📝 Templates'}
          {aba === 'usuarios' && '🔐 Usuários'}
        </h1>
        {carregando && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>A sincronizar dados...</div>}
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
        <button onClick={carregarTudo} className="btn-action" title="Recarregar dados">🔄</button>
      </div>
    </header>
  );
}
