-- Digital Command — an image description on each planner post
-- Run after 0037_creative_studio.sql. Safe to run more than once.
--
-- "Image idea": a short description of the picture a post should have (what it
-- shows, the setting, the mood). The AI suggests one alongside each caption, the
-- client can rewrite it in the post's Edit form or in Create image, and it drives
-- the AI photo / stock-photo search. Plain text, no separate policy needed — the
-- existing row-level policies on content_items already cover every column.
alter table public.content_items add column if not exists image_prompt text;
