// db.js - Single Source of Truth usando Supabase

async function getCategories() {
  if (!window.supabaseClient) return [];
  const { data, error } = await window.supabaseClient.from('categories').select('id, name');
  
  if (error) {
    console.error("Erro Supabase (Categorias):", error);
    return [];
  }
  
  if (!data || data.length === 0) {
    console.warn("Supabase retornou vazio para 'categories'. Verifique as Políticas RLS ou se fez o INSERT.");
  }
  
  return data || [];
}

async function getCourses() {
  if (!window.supabaseClient) return [];
  
  // Selecionando explicitamente as colunas exatas (com aspas duplas para o camelCase não quebrar no PostgREST)
  const { data, error } = await window.supabaseClient
    .from('courses')
    .select('id, tag, "categoryId", title, description, "currentPrice", "oldPrice", "isSpecialOffer", status, material_url, certificate_url');
    
  if (error) {
    console.error("Erro Supabase (Cursos):", error);
    return [];
  }
  
  if (!data || data.length === 0) {
    console.warn("Supabase retornou vazio para 'courses'. RLS pode estar bloqueando ou tabela vazia.");
  }
  
  return data || [];
}

// Salva um curso (Insert ou Update via UPSERT)
async function saveCourse(course) {
  if (!window.supabaseClient) return;
  const { error } = await window.supabaseClient.from('courses').upsert([course]);
  if (error) throw error;
}

// Exclui um curso
async function deleteCourseDB(id) {
  if (!window.supabaseClient) return;
  const { error } = await window.supabaseClient.from('courses').delete().eq('id', id);
  if (error) throw error;
}

// Salva uma categoria
async function saveCategory(category) {
  if (!window.supabaseClient) return;
  const { error } = await window.supabaseClient.from('categories').upsert([category]);
  if (error) throw error;
}

// Exclui uma categoria
async function deleteCategoryDB(id) {
  if (!window.supabaseClient) return;
  const { error } = await window.supabaseClient.from('categories').delete().eq('id', id);
  if (error) throw error;
}

window.db = { 
  getCategories, 
  getCourses, 
  saveCourse, 
  deleteCourseDB, 
  saveCategory, 
  deleteCategoryDB 
};
