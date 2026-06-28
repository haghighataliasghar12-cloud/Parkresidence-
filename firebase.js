import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://eeinzsdpvcjbzwmkmovm.supabase.co";
const SUPABASE_KEY = "sb_publishable_NkCUFreH26LWTQ-LC3cLGg_ktXNhTdx";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
