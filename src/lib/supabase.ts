import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // anon key is public by design; row-level security protects data
export const supabase = url && key ? createClient(url, key) : null;
