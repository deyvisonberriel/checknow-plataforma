// Cliente Supabase para o Frontend Vanilla JS

// URL e Chave Pública configurados conforme o .env.local
const SUPABASE_URL = 'https://kooxqkctwyrdodtmdhux.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z3lZBmkZzfcSS5nPQCkl4A_W5byj89G';

// Se a biblioteca via UMD estiver carregada, instanciamos o cliente global
if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("Supabase Client inicializado com sucesso!");
} else {
  console.error("A biblioteca do Supabase não foi carregada no navegador.");
}
