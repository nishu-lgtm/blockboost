/**
 * Admin layout — completely separate from the user dashboard.
 * Dark sidebar (gray-900) makes it visually distinct.
 */

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();

  // Server-side guard (middleware handles most cases, this is a fallback)
  if (!admin) {
    redirect("/dashboard");
  }

  // 2FA guard
  if (!admin.totpEnabled) {
    redirect("/admin/setup-2fa");
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <AdminSidebar
        adminName={admin.name ?? ""}
        adminEmail={admin.email}
        adminRole={admin.adminRole}
      />
      <div className="flex-1 ml-60 flex flex-col min-h-screen overflow-auto bg-gray-950">
        {children}
      </div>
    </div>
  );
}
