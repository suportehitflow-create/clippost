// Login e planos do Clipost no editor em massa.
// A tela manda o token de acesso do Supabase (Authorization: Bearer); aqui validamos com o Supabase.
import { createClient } from '@supabase/supabase-js';

// Nomes sem NEXT_PUBLIC_ são lidos em tempo de execução (servidor do editor no Fly)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } }) : null;

export async function obterUsuario(req: Request): Promise<string | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  if (!m || !supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(m[1]);
    return error ? null : data.user?.id ?? null;
  } catch {
    return null;
  }
}

export const naoAutenticado = () => Response.json({ erro: 'Faça login no Clipost para usar o editor.' }, { status: 401 });

export async function verificarLimite(
  _usuarioId: string | null,
  _quantidade: number,
): Promise<{ permitido: boolean; restantes?: number; motivo?: string }> {
  return { permitido: true };
}

export async function registrarVideoProcessado(_usuarioId: string | null, _nomeVideo: string): Promise<void> {
  // Contagem por plano: ligar ao mesmo contador dos cortes quando os limites do editor forem definidos
}
