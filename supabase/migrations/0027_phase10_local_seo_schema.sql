-- Digital Command — Phase 10 schema: Local SEO Toolkit
-- Run after 0026_roadmap_leads_language.sql.
--
-- Real Google Business Profile API access (60+ day verified profile, formal
-- request, rejections common) is the same external gate that's blocked
-- automated GBP posting/data since Phase 4 (see PROJECT_PLAN.md, Phase 8's
-- reviews table header comment). So this is scoped to what's genuinely
-- buildable today: the client tracks their own NAP (Name/Address/Phone) and
-- citation-directory listings by hand, and gets AI-drafted "Google Post"
-- text + local keyword suggestions to copy onto their own GBP account
-- themselves — same draft-here-post-yourself discipline as Phase 8.

-- ============================================================================
-- local_seo_profiles — one row per org. address/city/state/pincode/category
-- are NAP fields not already captured in brand_profiles (which only has
-- phone/whatsapp/locations as free text) — kept here rather than widening
-- brand_profiles since these are specifically for GBP/citation consistency,
-- not brand-voice/AI-prompt input.
-- ============================================================================
create table public.local_seo_profiles (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  address text,
  city text,
  state text,
  pincode text,
  gbp_category text,
  gbp_url text,
  citations_completed text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- local_seo_posts — AI-drafted "Google Post" text the client copies onto
-- their own GBP account and marks posted, plus local keyword suggestions
-- generated alongside it in the same AI call.
-- ============================================================================
create table public.local_seo_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  post_text text not null,
  keyword_suggestions text[] not null default '{}',
  status text not null default 'drafted' check (status in ('drafted', 'posted')),
  posted_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index local_seo_posts_org_id_idx on public.local_seo_posts (org_id, created_at desc);

-- ============================================================================
-- ai_usage_events — widen the feature check, same pattern as 0022's widening
-- for review_reply_draft.
-- ============================================================================
alter table public.ai_usage_events
  drop constraint ai_usage_events_feature_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_feature_check
  check (feature in (
    'content_generation', 'report_narrative', 'opportunity_assessment',
    'outreach_draft', 'campaign_brief', 'assistant_chat', 'review_reply_draft',
    'local_seo_post_draft', 'aeo_faq_draft'
  ));
