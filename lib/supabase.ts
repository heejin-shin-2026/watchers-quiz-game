import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** 브라우저용 anon 키 클라이언트 (RLS 정책으로 보호) */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }
  client = createClient(url, key);
  return client;
}
