"use client";

import { useRouter } from "next/navigation";

interface SidebarProps {
  aba: string;
  setAba: (aba: any) => void;
  isAdmin: boolean;
  isComercial: boolean;
  tarefasUrgentesCount: number;
  perfilAtivo: any;
  tema: string;
  alternarTema: () => void;
  handleLogout: () => void;
  onOpenSearch: () => void;
}

export function Sidebar({
  aba, setAba, isAdmin, isComercial, tarefasUrgentesCount,
  perfilAtivo, tema, alternarTema, handleLogout, onOpenSearch
}: SidebarProps) {
  const router = useRouter();

  return (
    <aside className="sidebar">
      <div style={{ padding: "24px 20px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>
        <img src={tema === 'dark' ? '/Logo-negativo.webp' : '/icon.png'} style={{ maxHeight: "36px", borderRadius: "8px" }} alt="SSTI" />
      </div>
      <nav className="nav-menu">
        {isComercial && <button className={`nav-item ${aba === 'dashboard' ? 'active' : ''}`} onClick={() => setAba('dashboard')}>📈 Dashboard</button>}
        {isComercial && (
          <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>
            🎯 Funil de Vendas
          </button>
        )}
        <button className={`nav-item ${aba === 'clientes' ? 'active' : ''}`} onClick={() => setAba('clientes')}>👥 Base de Clientes</button>
        {isAdmin && <button className={`nav-item ${aba === 'contratos' ? 'active' : ''}`} onClick={() => setAba('contratos')}>📄 Financeiro (MRR)</button>}
        <button className={`nav-item ${aba === 'tarefas' ? 'active' : ''}`} onClick={() => setAba('tarefas')}>
          ✅ Tarefas
          {tarefasUrgentesCount > 0 && <span className="notificacao-badge">{tarefasUrgentesCount}</span>}
        </button>
        {isAdmin && <button className={`nav-item ${aba === 'relatorios' ? 'active' : ''}`} onClick={() => setAba('relatorios')}>📊 Relatórios</button>}
        {isAdmin && <button className={`nav-item ${aba === 'templates' ? 'active' : ''}`} onClick={() => setAba('templates')}>📝 Templates</button>}
        {isAdmin && <button className={`nav-item ${aba === 'usuarios' ? 'active' : ''}`} onClick={() => setAba('usuarios')}>🔐 Usuários</button>}
        {isComercial && (
          <button
            className="nav-item"
            style={{ color: "#4A90D9", marginTop: "16px", border: "1px dashed #4A90D9", borderRadius: 10 }}
            onClick={() => router.push('/preco')}
          >
            ✚ Nova Proposta
          </button>
        )}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-light)" }}>
        <button
          onClick={onOpenSearch}
          style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "8px 12px", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}
        >
          🔍 <span>Pesquisar...</span>
          <kbd style={{ marginLeft: "auto", background: "var(--border-light)", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>⌘K</kbd>
        </button>
        <div style={{ fontSize: "11px", color: "#4A90D9", fontWeight: "bold", marginBottom: 2 }}>Simples Solução TI</div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: 4 }}>{perfilAtivo.perfil} · {perfilAtivo.filial}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={alternarTema} className="btn-action" style={{ flex: 1, textAlign: "center" }}>{tema === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={handleLogout} style={{ flex: 1, color: "#f87171", background: "none", border: "1px solid rgba(248,113,113,0.2)", cursor: "pointer", fontSize: "12px", padding: "6px", borderRadius: 6, fontWeight: 600 }}>Sair</button>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: 10, textAlign: "center" }}>v2.2</div>
      </div>
    </aside>
  );
}
