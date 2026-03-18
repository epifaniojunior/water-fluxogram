/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Credenciais embutidas conforme solicitado
const SUPABASE_URL_EMBEDDED = 'https://iylxrehsnzyljdlzpaor.supabase.co';
const SUPABASE_KEY_EMBEDDED = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bHhyZWhzbnp5bGpkbHpwYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODI2ODQsImV4cCI6MjA4OTI1ODY4NH0.VegGMVCKMnx5BJ39A0285nlfnE037DQ9kdgXj1Mr_C0';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_EMBEDDED;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY_EMBEDDED;

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://'));
};

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Ops! A configuração do Supabase está incompleta ou a URL é inválida. Verifique os Secrets.'
      );
    }
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
};

/**
 * Proxy para o cliente Supabase que inicializa apenas quando acessado.
 * Isso evita erros de "URL is required" durante o carregamento inicial do app.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop: keyof SupabaseClient) => {
    const supabaseClient = getSupabase();
    const value = supabaseClient[prop];
    if (typeof value === 'function') {
      return value.bind(supabaseClient);
    }
    return value;
  },
});
