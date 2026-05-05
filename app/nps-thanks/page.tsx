import Link from "next/link";

export default async function NPSThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ score?: string; feedback?: string }>;
}) {
  const params = await searchParams;
  const score = parseInt(params.score ?? "10", 10);
  const wantsFeedback = params.feedback === "1";

  const isPromoter = score >= 9;
  const isDetractor = score <= 6;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-4xl">{isPromoter ? "🎉" : isDetractor ? "💙" : "🙏"}</div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isPromoter
            ? "Thank you so much!"
            : isDetractor
            ? "Thanks for your honesty"
            : "Thanks for the feedback!"}
        </h1>
        <p className="text-slate-600">
          {isPromoter
            ? "We're really glad BlockBoost is working well for you. Your score means a lot."
            : isDetractor
            ? "We genuinely want to do better. If you have a moment, reply to the email and tell us what we missed."
            : "Your feedback helps us keep improving BlockBoost. We appreciate you taking the time."}
        </p>
        {wantsFeedback && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Want to tell us more?</strong>
            <br />
            Reply directly to the NPS email — Tom reads every response personally.
          </div>
        )}
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
