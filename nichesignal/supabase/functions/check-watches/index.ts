import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ── check-watches: weekly cron job ───────────────────────────────────────────
// Trigger via Supabase Dashboard → Edge Functions → Schedules:
//   Schedule: 0 8 * * 1  (every Monday 08:00 UTC)
//   Function: check-watches
//
// Fetches all active watches, re-analyses each keyword,
// logs delta to watch_history, and flags alerts where score delta > threshold.

interface WatchRow {
  id:              string
  user_id:         string
  keyword:         string
  last_score:      number | null
  last_verdict:    string | null
  alert_threshold: number
  last_checked_at: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // Allow manual trigger via POST (no body required)
  // Cron invocations arrive as GET from the Supabase scheduler
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  const runLog: Array<{ keyword: string; old: number|null; new: number; delta: number|null; alert: boolean }> = []
  const errors: Array<{ keyword: string; error: string }> = []

  try {
    // Fetch all watches
    const { data: watches, error: watchErr } = await supabase
      .from('watches')
      .select('id, user_id, keyword, last_score, last_verdict, alert_threshold, last_checked_at')

    if (watchErr) throw watchErr
    if (!watches || watches.length === 0) {
      return new Response(JSON.stringify({ message: 'No watches to process', processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    for (const watch of watches as WatchRow[]) {
      // 300ms stagger to avoid hammering analyse-keyword
      await new Promise(r => setTimeout(r, 300))

      try {
        // Force fresh analysis by bypassing cache at edge function level
        // (analyse-keyword will use DB cache if <24h old — that's fine for weekly check)
        const res = await fetch(`${supabaseUrl}/functions/v1/analyse-keyword`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ keyword: watch.keyword }),
        })

        if (!res.ok) {
          errors.push({ keyword: watch.keyword, error: `HTTP ${res.status}` })
          continue
        }

        const analysis = await res.json()
        const newScore  = analysis.overallScore as number
        const newVerdict = analysis.verdict as string
        const oldScore  = watch.last_score
        const delta     = oldScore !== null ? newScore - oldScore : null
        const alertTriggered = delta !== null && Math.abs(delta) >= watch.alert_threshold

        // Log to watch_history
        await supabase.from('watch_history').insert({
          watch_id:   watch.id,
          score:      newScore,
          verdict:    newVerdict,
          delta,
          checked_at: new Date().toISOString(),
        })

        // Update watch row
        await supabase.from('watches').update({
          last_score:      newScore,
          last_verdict:    newVerdict,
          last_checked_at: new Date().toISOString(),
        }).eq('id', watch.id)

        runLog.push({
          keyword: watch.keyword,
          old:     oldScore,
          new:     newScore,
          delta,
          alert:   alertTriggered,
        })

        // TODO: if alertTriggered, queue email notification
        // Requires Resend / SMTP integration — add in v0.2
        if (alertTriggered) {
          console.log(`ALERT: ${watch.keyword} score changed by ${delta} points (threshold: ${watch.alert_threshold})`)
        }
      } catch (err) {
        errors.push({ keyword: watch.keyword, error: (err as Error).message })
      }
    }

    return new Response(JSON.stringify({
      processed: runLog.length,
      errors:    errors.length,
      alerts:    runLog.filter(r => r.alert).length,
      log:       runLog,
      errorLog:  errors,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('check-watches error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
