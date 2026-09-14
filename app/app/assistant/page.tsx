import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export default async function AssistantPage() {
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">AI Assistant</h1>
        <p className="text-sm text-ink-500">
          Ask about your report, edit or regenerate a scheduled post, skip a day, or draft something new. Anything
          it changes still waits for your approval before it goes out.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
