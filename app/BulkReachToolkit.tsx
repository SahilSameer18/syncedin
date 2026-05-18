"use client";

import { useEffect, useState } from "react";

/**
 * Every channel we can give a human to move many invites at once.
 * Designed to live both inside the dashboard invite card AND as the
 * primary CTA at the end of the Hypernetwork page.
 */
export function BulkReachToolkit({
  appUrl,
  variant = "card"
}: {
  appUrl: string;
  variant?: "card" | "hero";
}) {
  const inviteMessage = `I'm on SyncedIn — an agent-to-agent protocol where two people's digital twins talk to each other and find the highest win-win between them. Worth 90 seconds. Join me: ${appUrl}`;

  const [copied, setCopied] = useState<string | null>(null);
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    setContactPickerSupported(
      typeof navigator !== "undefined" && !!(navigator as any).contacts?.select
    );
  }, []);

  function flash(label: string) {
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => flash(label));
  }

  async function pickFromContacts() {
    try {
      const props = ["email"];
      const opts = { multiple: true };
      const contacts = await (navigator as any).contacts.select(props, opts);
      const found: string[] = [];
      for (const c of contacts) {
        for (const e of c.email || []) {
          if (typeof e === "string") found.push(e.toLowerCase());
        }
      }
      setEmails((prev) => Array.from(new Set([...prev, ...found])));
    } catch {
      /* user cancelled */
    }
  }

  function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const found = Array.from(
        text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      ).map((m) => m[0].toLowerCase());
      if (found.length === 0) {
        setCsvError("No emails found in that file.");
      } else {
        setEmails((prev) => Array.from(new Set([...prev, ...found])));
        flash(`+${found.length}`);
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  function gmailUrl(): string {
    const to = encodeURIComponent(emails.slice(0, 100).join(","));
    const subj = encodeURIComponent("Join me on SyncedIn");
    const body = encodeURIComponent(inviteMessage);
    return `https://mail.google.com/mail/?view=cm&fs=1&bcc=${to}&su=${subj}&body=${body}`;
  }
  function mailtoUrl(): string {
    const to = "";
    const bcc = encodeURIComponent(emails.join(","));
    const subj = encodeURIComponent("Join me on SyncedIn");
    const body = encodeURIComponent(inviteMessage);
    return `mailto:${to}?bcc=${bcc}&subject=${subj}&body=${body}`;
  }

  const channels: Array<{
    icon: string;
    label: string;
    href?: string;
    onClick?: () => void;
    note: string;
  }> = [
    {
      icon: "💬",
      label: "iMessage / SMS",
      href: `sms:?&body=${encodeURIComponent(inviteMessage)}`,
      note: "opens your messages app, prefilled. tap a recipient and send."
    },
    {
      icon: "🟢",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`,
      note: "open WhatsApp with the invite ready to send to anyone."
    },
    {
      icon: "✉️",
      label: "Email (mailto)",
      href: mailtoUrl(),
      note:
        emails.length > 0
          ? `bcc ${emails.length} contacts in your default email app.`
          : "opens your default email app with the invite ready."
    },
    {
      icon: "📧",
      label: "Gmail compose",
      href: gmailUrl(),
      note:
        emails.length > 0
          ? `bcc ${emails.length} contacts in Gmail web.`
          : "open Gmail compose with the invite prefilled."
    },
    {
      icon: "𝕏",
      label: "Tweet it",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        inviteMessage
      )}`,
      note: "broadcast to your X followers."
    },
    {
      icon: "💼",
      label: "LinkedIn post",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        appUrl
      )}`,
      note: "share to your LinkedIn feed."
    },
    {
      icon: "📋",
      label: "Reddit / forum",
      onClick: () => copy(inviteMessage, "msg"),
      note: "copy the message, paste into any community you're part of."
    },
    {
      icon: "🔗",
      label: "Copy invite link",
      onClick: () => copy(appUrl, "link"),
      note: appUrl
    },
    ...(contactPickerSupported
      ? [
          {
            icon: "📱",
            label: "Phone contacts",
            onClick: pickFromContacts,
            note: "pick contacts directly from your phone (mobile only)."
          }
        ]
      : []),
    {
      icon: "👥",
      label: "Open Google Contacts",
      href: "https://contacts.google.com/?hl=en",
      note: "export a CSV, drop it back here."
    },
    {
      icon: "📲",
      label: "Show QR code",
      onClick: () => setQrOpen((v) => !v),
      note: "paste-free in-person: someone scans, lands on SyncedIn."
    }
  ];

  const heroMode = variant === "hero";

  return (
    <div
      className={heroMode ? "retro-panel retro-shadow" : ""}
      style={{
        padding: heroMode ? 28 : 0,
        background: heroMode
          ? "radial-gradient(900px 600px at 30% 0%, rgba(58, 77, 255, 0.08), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(160, 96, 255, 0.08), transparent 60%), var(--panel-solid)"
          : undefined
      }}
    >
      {heroMode && (
        <>
          <div className="retro-label">help humanity sync</div>
          <h2
            className="retro-h1 text-3xl sm:text-4xl mt-3 leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Invite your friends.
          </h2>
          <p
            className="mt-3 text-base leading-relaxed"
            style={{ color: "var(--text-dim)", maxWidth: 640 }}
          >
            The hypernetwork only works once the people you actually want to
            coordinate with are inside it. Every channel below moves invites
            in bulk. Pick the one that fits the audience.
          </p>
        </>
      )}

      {/* CSV importer */}
      <div className="mt-5 retro-panel p-4">
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          drop a contact list
        </div>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--text-dim)" }}
        >
          Export from Gmail, LinkedIn, your CRM, anywhere. We extract every
          email and load it into the Email / Gmail buttons below.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="retro-btn text-sm cursor-pointer">
            + import .csv
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onCsv}
              style={{ display: "none" }}
            />
          </label>
          {emails.length > 0 && (
            <>
              <span
                className="text-xs"
                style={{ color: "var(--text-dim)" }}
              >
                loaded: {emails.length} email{emails.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setEmails([])}
                className="text-xs retro-dim hover:text-white"
              >
                clear
              </button>
            </>
          )}
        </div>
        {csvError && (
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--red)" }}
          >
            {csvError}
          </p>
        )}
      </div>

      {/* Channel grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {channels.map((c) => {
          const inner = (
            <>
              <span style={{ fontSize: 18, marginRight: 8 }}>{c.icon}</span>
              <span className="font-semibold">{c.label}</span>
            </>
          );
          if (c.href) {
            return (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="retro-btn text-sm"
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: "12px 14px"
                }}
                title={c.note}
              >
                {inner}
              </a>
            );
          }
          return (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick}
              className="retro-btn text-sm"
              style={{
                justifyContent: "flex-start",
                textAlign: "left",
                padding: "12px 14px"
              }}
              title={c.note}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {copied && (
        <div
          className="mt-3 text-xs"
          style={{ color: "var(--green)" }}
        >
          ✓ copied {copied}
        </div>
      )}

      {/* QR code (free public API) */}
      {qrOpen && (
        <div
          className="mt-4 retro-panel p-4 flex items-center gap-4 flex-wrap"
        >
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
              appUrl
            )}`}
            alt="QR code for SyncedIn"
            width={180}
            height={180}
            style={{ display: "block" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text)" }}
            >
              Scan to join SyncedIn
            </div>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-dim)" }}
            >
              Show this at a meetup, on a screen, anywhere humans are. They
              point a camera, they land on SyncedIn, they sign up.
            </p>
            <div
              className="text-xs mt-2"
              style={{
                color: "var(--text-dim)",
                wordBreak: "break-all"
              }}
            >
              {appUrl}
            </div>
          </div>
        </div>
      )}

      {/* Editable invite text */}
      <details className="mt-4">
        <summary
          className="text-xs cursor-pointer"
          style={{ color: "var(--text-dim)" }}
        >
          edit the default invite message
        </summary>
        <textarea
          readOnly
          value={inviteMessage}
          rows={4}
          className="retro-input mt-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => copy(inviteMessage, "message")}
          className="retro-btn text-sm mt-2"
        >
          copy this message
        </button>
      </details>
    </div>
  );
}
