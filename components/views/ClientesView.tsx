import React from "react";
import { BadgeStatus } from "@/components/BadgeStatus";

interface ClientesViewProps {
  isComercial: boolean;
  isAdmin: boolean;
  setFormCliente: (val: any) => void;
  setModalClienteForm: (val: boolean) => void;
  perfilAtivo: any;
  setFormComunicado: (val: any) => void;
  setModalComunicado: (val: boolean) => void;
  mostrarDesativados: boolean;
  setMostrarDesativados: (val: boolean) => void;
  buscaCliente: string;
  setBuscaCliente: (val: string) => void;
  filtroTipoCliente: string;
  setFiltroTipoCliente: (val: any) => void;
  clientesAgrupados: any[];
  setClienteDetalhe: (val: any) => void;
  alternarStatusCliente: (cliente: any) => void;
}

export const ClientesView = ({
  isComercial, isAdmin, setFormCliente, setModalClienteForm, perfilAtivo,
  setFormComunicado, setModalComunicado, mostrarDesativados, setMostrarDesativados,
  buscaCliente, setBuscaCliente, filtroTipoCliente, setFiltroTipoCliente,
  clientesAgrupados, setClienteDetalhe, alternarStatusCliente
}: ClientesViewProps) => {
  return (
    <>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        {isComercial && (
          <button
            onClick={() => { setFormCliente({ nome: "", email: "", telefone: "", whatsapp: "", documento: "", tipo: "Cliente", codigo: "", filial: perfilAtivo.filial }); setModalClienteForm(true); }}
            className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}
          >+ Novo Registo</button>
        )}
        {isComercial && (
          <button
            onClick={() => { setFormComunicado({ publico: "Cliente", assunto: "", mensagem: "" }); setModalComunicado(true); }}
            className="btn-action" style={{ color: "#4A90D9", border: "1px solid #4A90D9", padding: "9px 18px", fontSize: 13, margin: 0 }}
          >📢 Comunicado em Massa</button>
        )}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", padding: "0 12px", borderRadius: 8, border: "1px solid var(--border-light)", cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={mostrarDesativados} onChange={e => setMostrarDesativados(e.target.checked)} />
            Exibir Inativos
          </label>
          <input className="input-modal" style={{ maxWidth: "240px", margin: 0, padding: "8px 12px" }} placeholder="🔍 Pesquisar..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
          <select className="input-modal" value={filtroTipoCliente} onChange={e => setFiltroTipoCliente(e.target.value as any)} style={{ maxWidth: "180px", margin: 0, padding: "8px 12px" }}>
            <option value="Todos">Todas as Categorias</option>
            <option value="Cliente">Apenas Clientes</option>
            <option value="Lead">Apenas Leads</option>
            <option value="Parceiro">Apenas Parceiros</option>
          </select>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        {clientesAgrupados.length} registo{clientesAgrupados.length !== 1 ? 's' : ''} encontrado{clientesAgrupados.length !== 1 ? 's' : ''}
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Nome / Cód</th><th>Contatos</th><th>Categoria</th><th>🔥 Score</th>{isComercial && <th>Histórico</th>}<th style={{ textAlign: "right" }}>Ação</th></tr>
          </thead>
          <tbody>
            {clientesAgrupados.map(c => (
              <tr key={c.nome} style={{ opacity: c.ativo === false ? 0.4 : 1 }}>
                <td>
                  <strong>{c.nome}</strong>
                  {c.codigo && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.codigo}</div>}
                  {c.ativo === false && <span style={{ fontSize: 10, color: "#f87171", fontWeight: "bold" }}> (INATIVO)</span>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>📞 {c.telefone || c.contato || '—'}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>💬 {c.whatsapp || '—'}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{c.email}</div>
                </td>
                <td><BadgeStatus status={c.tipo} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 'bold', color: (c.score || 0) >= 75 ? '#22c55e' : (c.score || 0) >= 45 ? '#f59e0b' : '#f87171' }}>
                    {c.score || 0} pts
                  </span>
                </td>
                {isComercial && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {c.propostas.length} prop{c.propostas.length !== 1 ? 's' : ''}
                      {c.contratos.filter((x: any) => x.status === 'Ativo').length > 0 && ` · ${c.contratos.filter((x: any) => x.status === 'Ativo').length} contrato(s)`}
                      {c.interacoes.length > 0 && <span style={{ color: "#4A90D9", display: "block" }}>{c.interacoes.length} nota(s)</span>}
                    </span>
                  </td>
                )}
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn-action" onClick={() => setClienteDetalhe(c)}>📋 Diário</button>
                  {isComercial && (
                    <button className="btn-action" onClick={() => {
                      setFormCliente({ id: c.isOficial ? c.id : undefined, nome: c.nome, email: c.email || "", telefone: c.telefone || "", whatsapp: c.whatsapp || "", documento: c.documento || "", tipo: c.tipo || "Lead", codigo: c.codigo || "", filial: c.filial || perfilAtivo.filial });
                      setModalClienteForm(true);
                    }}>Editar</button>
                  )}
                  {isAdmin && (
                    <button className="btn-action" style={{ borderColor: c.ativo === false ? "#22c55e" : "#f87171", color: c.ativo === false ? "#22c55e" : "#f87171", margin: 0 }} onClick={() => alternarStatusCliente(c)}>
                      {c.ativo === false ? 'Ativar' : 'Desativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
