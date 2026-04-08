import { supabase } from "@/lib/supabase";

// Definimos a interface aqui ou importamos de um ficheiro types.ts
export interface PropostaDB {
  id: number; created_at: string; numero: string; cliente: string; contato: string;
  valor: number; status: string; filial?: string; cliente_id?: number; // etc...
}

export const PropostasService = {
  // Busca as propostas com base na filial
  listar: async (filial?: string, isAdmin: boolean = false) => {
    let query = supabase.from('propostas').select('*').order('created_at', { ascending: false });
    
    if (!isAdmin && filial !== 'Matriz') {
      query = query.eq('filial', filial);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as PropostaDB[];
  },

  atualizarStatus: async (id: number, novoStatus: string) => {
    const { error } = await supabase.from('propostas').update({ status: novoStatus }).eq('id', id);
    if (error) throw error;
  }
};
