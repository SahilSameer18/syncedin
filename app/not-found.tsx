import Link from "next/link";

/**
 * Custom 404 page. Auto-rendered by Next.js App Router whenever any
 * page calls `notFound()` or a route doesn't match — replaces the
 * default "This page could not be found." stub.
 *
 * Jack: "Let's make a custom 404 page that has a joke about fixing
 * your sink and it has a link to homepage button or sign up."
 *
 * Tone: warm + dumb-dad-joke, not snarky. Two clear CTAs (home,
 * sign up). Matches site visual language — light bg, blue accent,
 * Wordmark up top.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)",
        color: "var(--text)",
        textAlign: "center"
      }}
    >
      {/* Big animated drip — pure CSS so no asset to load. The "sink"
          we said we'd fix. Two droplets falling on a 1.6s loop. */}
      <div
        aria-hidden="true"
        style={{
          width: 120,
          height: 120,
          position: "relative",
          marginBottom: 28
        }}
      >
        <style>{`
          @keyframes nf-drip {
            0%   { transform: translate(-50%, 0)   scale(1, 0.6); opacity: 1; }
            70%  { transform: translate(-50%, 70px) scale(0.7, 1.4); opacity: 1; }
            100% { transform: translate(-50%, 90px) scale(0.4, 0.4); opacity: 0; }
          }
          .nf-faucet {
            position: absolute;
            top: 0; left: 50%;
            transform: translateX(-50%);
            width: 56px; height: 36px;
            border-radius: 8px 8px 4px 4px;
            background: linear-gradient(180deg, #94a3b8 0%, #64748b 60%, #475569 100%);
            box-shadow: inset 0 -3px 0 rgba(0,0,0,0.18);
          }
          .nf-faucet::after {
            content: "";
            position: absolute;
            bottom: -10px; left: 50%;
            transform: translateX(-50%);
            width: 16px; height: 10px;
            border-radius: 0 0 4px 4px;
            background: #475569;
          }
          .nf-drop {
            position: absolute;
            top: 46px; left: 50%;
            width: 14px; height: 18px;
            border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
            transform-origin: 50% 0;
            animation: nf-drip 1.6s ease-in infinite;
          }
          .nf-drop.two {
            animation-delay: 0.8s;
          }
          .nf-puddle {
            position: absolute;
            bottom: 0; left: 50%;
            transform: translateX(-50%);
            width: 80px; height: 6px;
            border-radius: 50%;
            background: radial-gradient(
              ellipse at center,
              rgba(37, 99, 235, 0.35) 0%,
              rgba(37, 99, 235, 0) 70%
            );
          }
        `}</style>
        <div className="nf-faucet" />
        <div className="nf-drop" />
        <div className="nf-drop two" />
        <div className="nf-puddle" />
      </div>

      <h1
        style={{
          fontSize: "clamp(48px, 8vw, 88px)",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          margin: 0,
          background:
            "linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text"
        }}
      >
        404
      </h1>

      <p
        style={{
          marginTop: 14,
          fontSize: "clamp(20px, 2.8vw, 26px)",
          fontWeight: 800,
          letterSpacing: "-0.015em",
          maxWidth: 560
        }}
      >
        We&apos;re still fixing the sink in here.
      </p>

      <p
        style={{
          marginTop: 10,
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--text-dim)",
          maxWidth: 520
        }}
      >
        This page must&apos;ve gone down the drain. While we tighten the
        pipes, your twin is already out there networking for you —
        head home or get one set up in 30 seconds.
      </p>

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center"
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 22px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: "#1f59ff",
            borderRadius: 12,
            textDecoration: "none",
            boxShadow: "0 10px 24px -8px rgba(31, 89, 255, 0.5)"
          }}
        >
          ← Back to homepage
        </Link>
        <Link
          href="/login?next=%2Fonboarding%3Fwelcome%3D1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 22px",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text)",
            background: "transparent",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none"
          }}
        >
          Build my twin →
        </Link>
      </div>

      <p
        style={{
          marginTop: 26,
          fontSize: 12,
          color: "var(--text-dim)",
          fontStyle: "italic"
        }}
      >
        (Plumber not included.)
      </p>
    </main>
  );
}
