/**
 * Conversation route loading skeleton — rendered INSTANTLY by Next.js
 * the moment a user clicks into a /conversations/<id> link, while the
 * real page (auth check, DB fetches, prompt build) finishes on the
 * server. Massively reduces perceived navigation latency: blank
 * white-screen → bubble shimmer → real conversation, in that order.
 *
 * Keep this server-component-pure and zero-data so it streams in
 * sub-50ms.
 */
export default function ConversationLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col h-screen">
      {/* Header skeleton — matches the real layout's structure so the
          page doesn't jump when the real header renders. */}
      <div
        className="flex items-center gap-3 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          style={{
            width: 60,
            height: 36,
            borderRadius: 18,
            background: "var(--panel-2)",
            opacity: 0.6,
            animation: "sg-pulse 1.4s ease-in-out infinite"
          }}
        />
        <div className="flex-1 min-w-0">
          <div
            style={{
              height: 10,
              width: 50,
              background: "var(--panel-2)",
              opacity: 0.6,
              borderRadius: 4,
              marginBottom: 6
            }}
          />
          <div
            style={{
              height: 18,
              width: "60%",
              background: "var(--panel-2)",
              opacity: 0.5,
              borderRadius: 4,
              animation: "sg-pulse 1.4s ease-in-out infinite"
            }}
          />
        </div>
      </div>

      {/* Body — two shimmer bubbles (one from each side). */}
      <div className="flex-1 py-4 space-y-3">
        <div className="flex justify-start">
          <div
            style={{
              width: "70%",
              maxWidth: 360,
              height: 90,
              borderRadius: 18,
              background: "var(--panel-2)",
              opacity: 0.45,
              animation: "sg-pulse 1.6s ease-in-out infinite"
            }}
          />
        </div>
        <div className="flex justify-end">
          <div
            style={{
              width: "65%",
              maxWidth: 320,
              height: 70,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, rgba(58,77,255,0.25), rgba(139,61,255,0.25))",
              opacity: 0.55,
              animation: "sg-pulse 1.6s ease-in-out infinite",
              animationDelay: "0.3s"
            }}
          />
        </div>
        <div className="flex justify-start">
          <div
            style={{
              width: "55%",
              maxWidth: 280,
              height: 60,
              borderRadius: 18,
              background: "var(--panel-2)",
              opacity: 0.35,
              animation: "sg-pulse 1.6s ease-in-out infinite",
              animationDelay: "0.6s"
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes sg-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </main>
  );
}
