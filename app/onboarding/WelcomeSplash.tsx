/**
 * WelcomeSplash — first-impression hero on /onboarding for brand-new
 * users. Server component, renders only when `?welcome=1` is present so
 * returning users editing their twin never see it.
 *
 * Layout:
 *   - Big gradient halo
 *   - "Welcome, <FirstName>." headline
 *   - One-line manifesto: "Prepare for a synchronous future where the
 *     people you want to connect with and create magic with are found
 *     with ease."
 *   - If the user arrived via a claimed invite, a soft line acknowledging
 *     the inviter and a "your first conversation is ready" anchor.
 *   - Avatar peek (recipient_avatar_url that the claim route prefilled)
 *
 * Intentionally NOT a client component — no interactivity, just trust-
 * building copy + visuals.
 */
export function WelcomeSplash({
  firstName,
  avatarUrl,
  inviterName,
  conversationId
}: {
  firstName: string;
  avatarUrl: string | null;
  inviterName: string | null;
  conversationId: string | null;
}) {
  const greetName = firstName && firstName.trim().length > 0 ? firstName : "friend";

  return (
    <section
      style={{
        position: "relative",
        marginTop: 16,
        marginBottom: 24,
        padding: "22px 24px",
        borderRadius: 18,
        border: "1px solid var(--border)",
        background:
          "radial-gradient(800px 400px at 20% 0%, rgba(58,77,255,0.18), transparent 60%), radial-gradient(600px 400px at 90% 100%, rgba(216,59,255,0.16), transparent 60%), var(--panel-solid)",
        overflow: "hidden"
      }}
    >
      {/* Subtle scan line so it reads as sci-fi-welcome not generic card */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(94, 110, 255, 0.45), transparent)",
          opacity: 0.55
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          position: "relative",
          zIndex: 1,
          flexWrap: "wrap"
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={greetName}
            width={64}
            height={64}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--amber, #5e6eff)",
              boxShadow: "0 0 0 4px rgba(94,110,255,0.18)",
              flexShrink: 0
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--panel-2)",
              border: "2px solid var(--amber, #5e6eff)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text)",
              flexShrink: 0
            }}
          >
            {greetName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright, #94a4ff)" }}
          >
            welcome
          </div>
          <h2
            className="retro-h1"
            style={{
              fontSize: 28,
              lineHeight: 1.15,
              marginTop: 4,
              letterSpacing: "-0.01em"
            }}
          >
            Welcome, {greetName}.
          </h2>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--text-dim)",
              maxWidth: 620
            }}
          >
            Prepare for a synchronous future where the people you want to
            connect with and create magic with are found with ease.
          </p>
        </div>
      </div>

      {inviterName && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(94,110,255,0.08)",
            border: "1px solid rgba(94,110,255,0.18)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text)",
            position: "relative",
            zIndex: 1
          }}
        >
          <strong>{inviterName}</strong> already has a conversation waiting
          for you. Spin up your twin below and it&apos;ll be ready to talk
          to theirs the moment you&apos;re done
          {conversationId ? "." : "."}
        </div>
      )}
    </section>
  );
}
