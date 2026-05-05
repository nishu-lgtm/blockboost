import Link from "next/link";

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const type = params.type ?? "these emails";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-4xl">✉️</div>
        <h1 className="text-2xl font-bold text-slate-900">You&apos;re unsubscribed</h1>
        <p className="text-slate-600">
          You&apos;ve been unsubscribed from <strong>{type}</strong>. You
          won&apos;t receive these emails anymore.
        </p>
        <p className="text-sm text-slate-500">
          Note: billing and account-security emails are always sent regardless
          of your preferences.
        </p>
        <div className="pt-2 space-y-3">
          <Link
            href="/dashboard/settings?tab=emails"
            className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Manage email preferences
          </Link>
          <Link
            href="/dashboard"
            className="block w-full text-slate-600 hover:text-slate-900 text-sm underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
