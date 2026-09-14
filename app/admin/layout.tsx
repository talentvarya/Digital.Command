import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
    </div>
  );
}
