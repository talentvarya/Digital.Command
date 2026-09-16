import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewLinksForm } from "@/components/reputation/ReviewLinksForm";
import { SendReviewRequestForm } from "@/components/reputation/SendReviewRequestForm";
import { LogReviewForm } from "@/components/reputation/LogReviewForm";
import { ReviewCard } from "@/components/reputation/ReviewCard";

export default async function ReputationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/register/details");
  const orgId = membership.org_id;

  const [{ data: org }, { data: settings }, { data: reviews }, { data: requests }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", orgId).single(),
    supabase.from("client_settings").select("google_review_link, facebook_review_link").eq("org_id", orgId).maybeSingle(),
    supabase.from("reviews").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("review_requests").select("id").eq("org_id", orgId),
  ]);

  const reviewList = reviews ?? [];
  const ratedReviews = reviewList.filter((r) => r.rating !== null);
  const avgRating = ratedReviews.length ? ratedReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratedReviews.length : null;
  const needsReplyCount = reviewList.filter((r) => r.reply_status === "needs_reply").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Reputation Management</h1>
        <p className="text-sm text-ink-500">
          Ask for reviews through your own WhatsApp/SMS/email, log what comes in, and post an AI-drafted reply
          yourself — Digital Command never posts to Google or Facebook automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Requests sent</div>
          <div className="text-2xl font-bold text-ink-900">{requests?.length ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Average rating</div>
          <div className="text-2xl font-bold text-ink-900">{avgRating !== null ? avgRating.toFixed(1) : "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Awaiting reply</div>
          <div className="text-2xl font-bold text-ink-900">{needsReplyCount}</div>
        </div>
      </div>

      <ReviewLinksForm googleReviewLink={settings?.google_review_link ?? null} facebookReviewLink={settings?.facebook_review_link ?? null} />

      <SendReviewRequestForm
        businessName={org?.legal_name ?? "us"}
        googleReviewLink={settings?.google_review_link ?? null}
        facebookReviewLink={settings?.facebook_review_link ?? null}
      />

      <LogReviewForm />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">Reviews</h2>
        {reviewList.length === 0 && <p className="card text-center text-sm text-ink-400">No reviews logged yet.</p>}
        {reviewList.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
