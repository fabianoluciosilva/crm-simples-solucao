// utils/crmLogic.ts

export const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatarWhatsApp = (numStr?: string) => {
  if (!numStr) return "";
  let n = numStr.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) return "55" + n;
  return n;
};

export const calcDiasAtraso = (dataVenc: string): number => {
  const hoje = new Date();
  const venc = new Date(dataVenc);
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

export const analisarSentimento = (texto: string): { 
  sentimento: 'positivo' | 'neutro' | 'negativo'; 
  deltaScore: number; 
  emoji: string;
  label: string;
} => {
  const t = texto.toLowerCase().trim();
  const positivo = ['ótimo', 'excelente', 'gostei', 'perfeito', 'obrigado', 'parabéns', 'satisfeito', 'bom', 'ótima', 'maravilhoso', 'recomendo', 'ajudou', 'rápido'];
  const negativo = ['ruim', 'problema', 'insatisfeito', 'cancelar', 'caro', 'lento', 'não gostei', 'reclamação', 'atraso', 'pior', 'decepcionado', 'demora', 'caiu'];

  let score = 0;
  positivo.forEach(p => { if (t.includes(p)) score += 2; });
  negativo.forEach(n => { if (t.includes(n)) score -= 3; });

  if (score > 1) return { sentimento: 'positivo', deltaScore: 7, emoji: '😊', label: 'Positivo' };
  if (score < -1) return { sentimento: 'negativo', deltaScore: -9, emoji: '😟', label: 'Negativo' };
  return { sentimento: 'neutro', deltaScore: 2, emoji: '😐', label: 'Neutro' };
};

export const calcularChurnRisk = (cliente: any): { 
  score: number; 
  nivel: 'Baixo' | 'Médio' | 'Alto'; 
  cor: string; 
  emoji: string;
  recomendacao: string;
} => {
  const scoreAtual = cliente.score || 50;
  
  const ints = cliente.interacoes || [];
  let diasSemContato = 30;
  if (ints.length > 0) {
    const dataRef = new Date(ints[0].created_at).getTime();
    diasSemContato = Math.floor((Date.now() - dataRef) / (1000 * 60 * 60 * 24));
  }

  const chamadosAbertos = cliente.tarefas?.filter((t: any) => t.status !== 'Concluído').length || 0;
  
  const scoreComponent = 100 - scoreAtual;
  const diasComponent = Math.min((diasSemContato / 30) * 100, 100);
  const chamadosComponent = Math.min(chamadosAbertos * 12, 100);
  const quedaComponent = diasSemContato > 10 ? 60 : 20;

  let churnScore = Math.round(
    (scoreComponent * 0.40) + (diasComponent * 0.25) + 
    (chamadosComponent * 0.15) + (quedaComponent * 0.10) + 10
  );
  churnScore = Math.max(0, Math.min(100, churnScore));

  if (churnScore < 35) {
    return { score: churnScore, nivel: 'Baixo', cor: '#22c55e', emoji: '✅', 
             recomendacao: 'Cliente saudável. Manter engajamento normal.' };
  } else if (churnScore < 65) {
    return { score: churnScore, nivel: 'Médio', cor: '#f59e0b', emoji: '⚠️', 
             recomendacao: 'Monitorar. Agendar contato nos próximos 7 dias.' };
  } else {
    return { score: churnScore, nivel: 'Alto', cor: '#f87171', emoji: '🔴', 
             recomendacao: 'Risco alto! Ligar hoje + oferecer ação de retenção.' };
  }
};

export const gerarSugestaoIA = (cliente: any): { 
  titulo: string; 
  acao: string; 
  motivo: string; 
  prioridade: 'Alta' | 'Média' | 'Baixa';
  emoji: string;
} => {
  const risk = calcularChurnRisk(cliente);
  
  const ints = cliente.interacoes || [];
  let diasSemContato = 999;
  if (ints.length > 0) {
    const dataRef = new Date(ints[0].created_at).getTime();
    diasSemContato = Math.floor((Date.now() - dataRef) / (1000 * 60 * 60 * 24));
  }

  const chamadosAbertos = cliente.tarefas?.filter((t: any) => t.status !== 'Concluído').length || 0;

  if (risk.nivel === 'Alto') {
    return { titulo: "Ação Urgente de Retenção", acao: "Ligar hoje + oferecer check-up ou desconto", 
             motivo: "Risco alto de churn detectado", prioridade: "Alta", emoji: "🔴" };
  }
  if (diasSemContato > 14 && diasSemContato !== 999) {
    return { titulo: "Reengajamento Necessário", acao: "Enviar mensagem personalizada ou ligar para retomar contato", 
             motivo: `${diasSemContato} dias sem interação`, prioridade: "Alta", emoji: "⚠️" };
  }
  if (chamadosAbertos >= 2) {
    return { titulo: "Acompanhamento de Suporte", acao: "Verificar chamados abertos e propor solução ou upgrade", 
             motivo: `${chamadosAbertos} chamados em aberto`, prioridade: "Média", emoji: "🛠️" };
  }
  if (risk.nivel === 'Médio') {
    return { titulo: "Manter Engajamento", acao: "Agendar contato nos próximos 7 dias ou enviar conteúdo relevante", 
             motivo: "Risco médio - prevenção", prioridade: "Média", emoji: "🟡" };
  }
  return { titulo: "Oportunidade de Expansão", acao: "Verificar se há potencial de upsell (firewall, backup, etc.)", 
           motivo: "Cliente saudável - momento ideal para expansão", prioridade: "Baixa", emoji: "✅" };
};
