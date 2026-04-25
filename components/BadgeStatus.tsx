import React from "react";

interface BadgeStatusProps {
  status: string;
}

export const BadgeStatus = ({ status }: BadgeStatusProps) => {
  const cores: Record<string, { bg: string; color: string }> = {
    fechada: { bg: '#22c55e22', color: '#22c55e' },
    perdida: { bg: '#f8717122', color: '#f87171' },
    aberta:  { bg: '#64748b22', color: '#94a3b8' },
    enviada: { bg: '#4A90D922', color: '#4A90D9' },
    negociacao: { bg: '#4A90D922', color: '#4A90D9' },
    Ativo:    { bg: '#22c55e22', color: '#22c55e' },
    Cancelado:{ bg: '#f8717122', color: '#f87171' },
    Pendente: { bg: '#f59e0b22', color: '#f59e0b' },
    'Concluído':{ bg: '#22c55e22', color: '#22c55e' },
    Atrasado: { bg: '#f8717122', color: '#f87171' },
    'Em Andamento': { bg: '#4A90D922', color: '#4A90D9' },
    default:  { bg: '#f59e0b22', color: '#f59e0b' },
  };
  const c = cores[status] || cores.default;
  return (
    <span className="badge-status" style={{ background: c.bg, color: c.color }}>
      {status === 'negociacao' ? 'Negociação' : status || 'aberta'}
    </span>
  );
};
