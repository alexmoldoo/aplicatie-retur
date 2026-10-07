/**
 * Clientul Supabase unic al aplicației (server-side, cu service role).
 *
 * Toate modulele îl folosesc pe acesta, în loc să-și creeze fiecare propriul
 * client: o singură conexiune caldă către bază, refolosită de toate cererile.
 * Fără sesiune de auth (nu e nevoie pe server, cheia service role e fixă).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (process.env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const supabaseServer: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null
