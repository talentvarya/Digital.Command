# Digital Command — Deployment Checklist

Every production outage this project has had was the same thing: a setting that was never added (a Vercel environment variable, or a Supabase dashboard setting), invisible until someone clicked the broken feature. This is the list to walk through on a new deployment and after any change to hosting. The admin **Config Health** page (`/admin/health`) checks the environment-variable half of it for you.

Live deployment: <https://digital-command.vercel.app> · GitHub: `talentvarya/Digital.Command` (`main`; Vercel deploys on push, and a deploy can lag a few minutes behind the push).

## 1. Vercel environment variables

Settings → Environment Variables. A change only takes effect on the **next deploy** — redeploy after editing.

**Type must be "Config" (plain), not "Secret", for every `NEXT_PUBLIC_` variable.** A Secret-typed `NEXT_PUBLIC_` variable is silently empty at build time and breaks every page.

| Variable | Required | What breaks without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Every page fails |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Every page fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | The public roadmap form and the nightly Autopilot job fail |
| `NEXT_PUBLIC_SITE_URL` | Yes | Google connect and redirect links point to the wrong address. Use the exact deployed address, no trailing slash |
| `CRON_SECRET` | Yes | The nightly job is rejected (401) and never runs. Any long random string |
| `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` / `OPENAI_API_KEY` to match `AI_PROVIDER`) | Yes | Every AI feature errors |
| `AI_PROVIDER` | No | Defaults to `anthropic`. The AI Assistant is always Claude |
| `BUFFER_ACCESS_TOKEN` | For publishing | Facebook/Instagram posts are never sent; content stays "Scheduled" |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | For Google connections | Search Console, Analytics and YouTube can't be connected |
| `TOKEN_ENCRYPTION_KEY` | Recommended | Google/Apify tokens saved afterwards are stored as readable text. **Set once, never change or lose it** — see `SECURITY_AND_RLS.md` |
| `UNSPLASH_ACCESS_KEY` | No | Planner posts get no automatic stock photo, and Create image can't use stock photos |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN` | No | The free "AI photo" background in Create image is unavailable (brand-colour and stock-photo graphics still work). Free Cloudflare account; token needs only the "Workers AI" permission |
| `CREATIVE_AI_DAILY_LIMIT` | No | Platform-wide cap on AI photos per day; default 150, safely under the free allowance (~170+/day). Raise it after upgrading the Cloudflare plan |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` + `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | No | Brand-mention search is unavailable |
| `NEXT_PUBLIC_VMG_WHATSAPP_NUMBER` | No | The roadmap page's WhatsApp button stays disabled. Digits only with country code, e.g. `919876543210` |
| `NEXT_PUBLIC_VMG_PHONE` | No | The roadmap page's "Call now" button falls back to email. e.g. `+919876543210` |

`.env.example` documents each one, including how to obtain it.

## 2. Supabase dashboard settings

- **Authentication → URL Configuration → Site URL** = the deployed address (not `localhost`). If this is wrong, confirmation emails send people to a dead link. Add the deployed address (and `…/**`) to Redirect URLs as well.
- **Authentication → Providers → Email**: confirm-email on is fine — the app handles the confirmation redirect.
- **Storage**: the four private buckets (`verification-documents`, `payment-screenshots`, `brand-assets`, `content-media`) are created by migrations `0003`/`0007` — nothing to do by hand.

## 3. Database migrations

Supabase → SQL Editor → paste the **contents** of each file (never the file name) and run, in numeric order. Each one can be skipped if already applied.

`0001` → `0038` in `supabase/migrations/`. The latest six (`0033` Buffer insights, `0034` protected `client_settings` columns, `0035` cron log, `0036` AI-answer checks, `0037` Creative Studio usage log, `0038` the "Picture idea" column) are safe to re-run. Until `0037` is applied, AI photos are refused (they fail closed, because their daily usage can't be counted); brand-colour and stock-photo graphics still work. Until `0038` is applied, a picture description still works for the graphic being made, but it isn't remembered on the post (every write that includes the column falls back to the old behaviour on a database without it).

After the migrations, run `supabase/tests/tenant_isolation_test.sql` (as its own query or pasted right after them — both are safe). It returns a result table: expect `Cross-tenant leaks found: 0`, the admin-column line to read `PROTECTED`, and the last line `RESULT: PASS`. `FAIL`, `NOT RUN` or `TEST INVALID` mean something needs a look. This is the empirical two-client isolation check; run it again after any change to policies. Last live result (2026-09-22): PASS on 36 tables. (The same test also runs automatically on every push against an in-memory copy built from the migration files — that catches a bad migration, but only this live run can see a difference between the files and the real project.)

## 4. Post-deploy checks

1. Admin → **Config Health**: "Every required setting is present." Fix anything red.
2. Admin → Dashboard: no red or amber job banner (after the first 03:00 UTC run, the Config Health page shows the nightly job as Healthy).
3. Register a throwaway client, walk it through payment and Super Admin approval, and confirm the dashboard opens.
4. Planner: generate a post; open it; check the time reads as the intended IST slot.
5. Creative Studio: on a test client's post press **Create image** (Background: Brand colours) — a graphic with the post's words and the client's colours/logo should appear on the post. With the Cloudflare variables set, repeat with **AI photo**; the first real call is also the check that Cloudflare's response is read correctly.
6. Link a Buffer channel for a **test** client and use "Send now" on a scheduled post — only ever to a test channel, never to a real client's page without their say-so.
7. Client home (Command Center): it opens on "Needs your attention" / "Ready for your approval" and six result tiles. On a client with no Google connection the Google tiles must say what to connect (not show zeros). Approve one post from the home page and confirm it disappears from the list and shows as Scheduled in the planner.
8. Reports: generate a report, press **Download PDF**, and open it — two pages, the business name and period on top, figures that match the report card, and "Not connected yet" (not 0) for any Google source that isn't connected. Hindi text in the summary should show properly.
9. If `TOKEN_ENCRYPTION_KEY` is set: connect Google (or an Apify token) on a test client and confirm the connection works, then confirm the stored value in `google_connections` / `apify_connections` starts with `enc:v1:`.

## 5. Things that need a person, not code

- Adding any API key or token: only the account owner adds these (in Vercel, or on the client's own Apify/Buffer account). They are never pasted into chat or into a support ticket.
- A real post to a real client's Facebook/Instagram: needs that client's explicit go-ahead, every time.
- Paid Apify runs (Maps search, AI-answer check) bill the client's own Apify account — never run one just to "see if it works".
- Ads and WhatsApp automation need third-party credentials and approvals that don't exist yet.
