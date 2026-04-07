import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// Usamos as chaves públicas normais; a segurança já foi tratada na função SQL (RPC)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'open' ou 'click'
  const id = searchParams.get('id');
  const url = searchParams.get('url');

  if (id && action) {
    // Abriu email = +10 | Clicou = +20
    const pontos = action === 'open' ? 10 : 20;
    
    // Chama a nossa função SQL para atualizar a pontuação no banco de dados
    await supabase.rpc('incrementar_score', { cliente_id: parseInt(id), pontos });
  }

  if (action === 'open') {
    // Retorna a imagem invisível de 1x1 pixel (GIF)
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  }

  if (action === 'click' && url) {
    // Regista os pontos e redireciona para o link verdadeiro
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ success: true });
}
