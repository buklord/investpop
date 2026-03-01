import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      {
        connected: false,
        error: 'Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      },
      { status: 200 }
    )
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
  )

  const { data, error } = await supabase.auth.getSession()

  return Response.json({
    connected: !error,
    error: error?.message || null,
  })
}