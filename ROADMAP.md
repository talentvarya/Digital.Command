# Digital Command — Roadmap (Waves 1–3)

Written 2026-09-26, after the "what is missing from our software?" review. This is the working list of what
gets built next, in what order, what each step needs from the owner (Vineet), and what was deliberately left out.
It sits on top of [PROJECT_PLAN.md](PROJECT_PLAN.md) (what has shipped) and does not repeat it. (This is the internal build plan — not the public `/roadmap` page, which is VMG's own sales tool.)

**Status words:** `Shipped` = live on the site · `Built` = code is in and tested, waiting on one owner step ·
`Next` = designed, will be built without needing any outside account · `Needs setup` = cannot start until the owner
creates an account or key · `Needs approval` = depends on a platform (Google, Meta) approving us · `Not doing` = decided against.

The guiding idea, from the owner: **solve the customer's real problems** — "Am I getting customers? Do I have time
to post? Do people who message me get a reply? Do my reviews look good?" — and show the answer on the first screen.

---

## Decisions already made

| Decision | Why |
| --- | --- |
| **n8n is not part of the plan.** | The owner decided against it. Automation stays inside the app (daily cron jobs, Autopilot, approval queue), where it is already logged, permission-checked and stopped by Master STOP. |
| **Ads and WhatsApp automation come last.** | The owner asked for them at the end. Both need platform approvals and carry real spending or spam risk. |
| **Images: free tools only, ≤ 50 a day for now.** | Brand-colour graphics (drawn by us), Unsplash stock, and AI photos from Cloudflare Workers AI (free daily allowance). If volume grows, paying for a bigger plan is an easy later switch. Gemini's image API was checked on the official pricing page and has **no** free tier, so it is not used. |
| **No promises about rankings.** | Nothing in the product or in generated text may guarantee a Google/AI ranking, traffic or sales. Numbers shown are only ones we actually measured. |
| **Real client accounts are never used for testing destructive actions.** | Aura Lux Chocolate Co. and Vineet Events Creation are live clients. |
| **Secrets are added by the owner, never pasted into chat or typed by the assistant.** | Keys go into Vercel by the owner. |
| **No paid third-party runs (Apify etc.) without the owner's explicit yes each time.** | They cost real money. |

---

## Wave 1 — needs no outside approval (build first)

| # | What | Status | Notes |
| --- | --- | --- | --- |
| 1.1 | **Creative Studio** — branded post graphics (4 looks, brand colours + logo, Hindi text renders correctly) with 3 free backgrounds: brand colours, stock photo, AI photo. "Create images for the next posts" in one click. | `Shipped` | AI photos need the owner to run migration 0037 and add the two Cloudflare values in Vercel. |
| 1.2 | **Picture description** — every post has a "what should the picture show" box (the AI suggests one with each caption; the client can edit it). The AI photo is made **only after** the client presses the button. | `Shipped` (code) | Needs migration 0038 to *save* the description; until then it still works but isn't remembered. |
| 1.3 | **Command Center** — the client home page now opens on what needs them: fix-now / to-do list, posts waiting for approval with an **Approve** button right there, six result tiles (Google clicks, website visits, visibility score, leads & sales, reviews, posts lined up) with real trends only, and a plain-language activity feed. | `Shipped` | Tiles that have no data yet say what to connect instead of showing a made-up zero. |
| 1.4 | **Monthly PDF report** — a clean, branded, downloadable report (what was done, the numbers, the plan for next month) that a client can forward. A **Download PDF** button on every report. | `Shipped` | Uses only numbers already in the report; no invented figures. Also fixed: the report's AI summary was always told the SEO audit found 0 issues. |
| 1.5 | **Autopilot graphics** — when Autopilot fills the planner overnight, make the graphics too, inside the free daily limits. | `Next` | Small; held until the owner has seen Creative Studio work live. |

## Wave 2 — small setup by the owner, or none

| # | What | Status | Needs from owner |
| --- | --- | --- | --- |
| 2.1 | **Customers & WhatsApp lists** — a private customer list per business (name, number, tags, "agreed to receive messages" tick, "asked to stop"), paste-in import, and one-tap **click-to-chat** WhatsApp links with a ready message in English or Hindi (festival wishes, offer, thank-you, review request). The client taps each link and presses send themselves; nothing is sent automatically, so there is no spam or WhatsApp-ban risk. | `Built` | Run migration `0039` (in the combined SQL file). Only people marked as having agreed are listed for messages; a Super Admin cannot see the list. |
| 2.2 | **Email** (via Brevo): review requests, offers, and a daily/weekly "posts waiting for your approval" email so clients don't have to remember to log in. | `Needs setup` | Create a Brevo account, verify a sending address, add `BREVO_API_KEY` in Vercel. Needs a consent tick and an unsubscribe link built in from day one. |
| 2.3 | **Team members** — a business owner invites a helper (approve/edit posts but not billing). | `Needs setup` | A short design conversation first (roles, what a helper may see). It touches security rules, so it gets its own careful pass. |
| 2.4 | **Billing** — Razorpay/UPI payments and GST invoices instead of manual screenshot checking. | `Needs setup` | A Razorpay account, and the exact GST details for invoices (GSTIN, address, SAC code, numbering). These must come from the owner — invoices with wrong tax details are a legal problem. |
| 2.5 | **Festival & occasion calendar** — a "Coming up" card in the planner with India's big festivals and business occasions (dates checked against Drik Panchang), a "Plan a Facebook / Instagram post" button for each that writes an approval-first draft, and a nudge on the home page. Nothing is ever planned for a festival by itself. | `Shipped` | Nothing. The dates run to the end of 2027 — extending them each year is a small yearly job (`lib/occasions/calendar.ts`). |
| 2.6 | **Tracking-code checklist** — a guided "install Google Analytics / Search Console / Clarity on your website" so the Command Center tiles fill up. | `Next` | Nothing. |

## Wave 3 — needs outside approvals, or paid data

| # | What | Status | Needs |
| --- | --- | --- | --- |
| 3.1 | **Tracked keywords with rank history** — the client lists the words that matter; a check records their Google position over time. Reuses the client's **own** Apify account (paid per run, so only when the client presses the button — never on a hidden schedule). | `Next` (code with test doubles only) | The owner's approval for **one** real paid run to prove it works. Until then it is marked "not yet proven live". |
| 3.2 | **Blog writer** — AI drafts a search-friendly blog post from a topic + Brand Brain, saved as a draft to copy into the client's site. | `Next` | Nothing. (Publishing straight into a client's website/CMS is a separate, later project.) |
| 3.3 | **Keyword research** (search volume, difficulty, ideas) | `Needs setup` | A pay-per-use keyword data service account. We do not build our own index. |
| 3.4 | **Ads: read-only reporting, then approval-based launch** (Google Ads, Meta Ads) | `Needs approval` | Developer/app approvals from Google and Meta, and a spending-limit design. Launch stays "client approves every rupee". |
| 3.5 | **WhatsApp official API** (automatic replies, broadcasts) | `Needs approval` | Meta business verification and message-template approval. Until then, 2.1 covers the need safely. |
| 3.6 | **Google Business Profile API** (live reviews, posting) | `Needs approval` | Google must approve API access. Today reviews are logged by hand and posts are copied across. |
| 3.7 | **Local rank grid** (where you show up on the map, block by block) | `Needs setup` | Paid local-rank data service. |
| 3.8 | **More AI-answer engines** (beyond the one now supported) | `Needs setup` | A paid test run approved by the owner first. |
| 3.9 | **More social** — LinkedIn / X posting, and a shared inbox for comments and messages | `Needs approval` | Per-platform API approval. Comes after Facebook/Instagram/YouTube are solid. |
| 3.10 | **Client-website CMS** — connect to a client's website and make SEO edits automatically | `Needs setup` | Paused by the owner; needs its own planning conversation (see "Future CMS idea"). |

## Small fixes and hardening

| Item | Status |
| --- | --- |
| Rejecting or skipping a post was logged as `content_rejectd` / `content_skipd` (a typo). | Done — new entries are spelt correctly and old ones still read correctly in the activity feed. |
| The planner worked out "today" from the server's UTC date, so between midnight and 5:30 AM India time it was a day behind (the planner's first day, the Autopilot fill, the assistant's idea of "today", a report's end date, and the send-pending-posts job). All now count from today in India (`lib/utils/ist.ts`). | Done |
| Every new table in this roadmap must pass the tenant-isolation test (`supabase/tests/tenant_isolation_test.sql`, run in CI) before release. | Standing rule |

## Not doing

| Idea | Reason |
| --- | --- |
| **n8n** | Decided against by the owner. |
| Building our own keyword/backlink index (an Ahrefs/Semrush clone) | Years of crawling and huge cost. We connect to a data service instead. |
| Heatmaps and session recordings (Hotjar-style) | Link out to Microsoft Clarity (free) instead — see 2.6. |
| A full design editor (Figma/Canva-style) | Creative Studio covers post graphics; anything more complex is done in a design tool. |
| Guaranteeing rankings, traffic or sales | Never promised, in the product or in generated text. |

## What only the owner can do (short list)

1. Run `5-RUN-ALL-LATEST-updates.sql` (in `D:CLAUDE LOCAL SERVERSQL-TO-RUN`): it adds the AI-photo usage log (0037), the picture-description column (0038) and the customer list (0039) in one go, and is safe to run twice. Paste the **contents** into the Supabase SQL Editor, not the file name; its result table must read `true, true, true, 4, false`.
2. Create a free Cloudflare account and add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` in Vercel (as plain "Config" values, Production), then redeploy. The first AI photo is the live test.
3. Confirm the environment values on the Health page (`/admin/health`).
4. Decide, when ready: link Aura Lux's Buffer channel and approve the first real post; approve one paid Apify run for 3.1; create Brevo and Razorpay accounts (2.2, 2.4); provide the GST details (2.4).
