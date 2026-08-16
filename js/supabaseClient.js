// Fill these in from Supabase → Project Settings → API
// SUPABASE_URL: "Project URL"
// SUPABASE_ANON_KEY: "anon public" key (safe to expose in client code —
// row-level security policies control what it can actually do)

const SUPABASE_URL = "https://rdbsfspfvetykkijukgk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_M4NdMYOaDto9hzCeZFVzCg_uguKyaFc";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
