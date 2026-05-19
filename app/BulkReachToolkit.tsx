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
  // Richer contact entries: name + ANY of {email, phone, profile URL}.
  // The contact field auto-classifies the input so the user can paste
  // whatever they have for that person — even a LinkedIn / X / IG / FB
  // profile URL. When a profile URL is provided, the server scrapes it
  // and uses the result to personalize the invite opener.
  const [entries, setEntries] = useState<
    Array<{
      name: string;
      email?: string;
      phone?: string;
      profile_url?: string;
    }>
  >([]);
  const [entryName, setEntryName] = useState("");
  const [entryContact, setEntryContact] = useState("");

  // Recognize handles / URLs for LinkedIn, X / Twitter, Instagram, Facebook.
  const SOCIAL_HOSTS_RE =
    /(?:linkedin\.com|x\.com|twitter\.com|instagram\.com|facebook\.com|fb\.com)\b/i;

  function classifyContact(s: string): {
    email?: string;
    phone?: string;
    profile_url?: string;
    derived_name?: string;
  } {
    const t = s.trim();
    if (!t) return {};

    // Profile URL (handles bare domains too — e.g. "linkedin.com/in/foo")
    if (SOCIAL_HOSTS_RE.test(t)) {
      let url = t;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      // Try to derive a friendly name from the handle path
      let derived = "";
      try {
        const parsed = new URL(url);
        const seg = parsed.pathname
          .split("/")
          .filter(Boolean)
          .filter((s) => s !== "in") // linkedin uses /in/handle
          .pop();
        if (seg) {
          derived = seg
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .replace(/\d+$/, "")
            .trim();
        }
      } catch {
        /* malformed URL */
      }
      return { profile_url: url, derived_name: derived || undefined };
    }
    // Email
    if (/@/.test(t)) return { email: t.toLowerCase() };
    // Phone (digits + leading + only).
    const digits = t.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 7) return { phone: digits };
    return {};
  }

  function profileLabel(url?: string): string {
    if (!url) return "";
    if (/linkedin\.com/i.test(url)) return "LinkedIn";
    if (/(x|twitter)\.com/i.test(url)) return "X";
    if (/instagram\.com/i.test(url)) return "Instagram";
    if (/(facebook|fb)\.com/i.test(url)) return "Facebook";
    return "Profile";
  }
  const [csvError, setCsvError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [importHelp, setImportHelp] = useState<null | "linkedin" | "google">(
    null
  );
  const [personalized, setPersonalized] = useState<
    Array<{
      contact: { name: string; email?: string; phone?: string };
      slug: string;
      url: string;
      starter: string;
    }>
  >([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

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

  function addEntry() {
    const typed = entryName.trim();
    const { email, phone, profile_url, derived_name } =
      classifyContact(entryContact);
    // Prefer a typed name. If empty, fall back to a name derived from the
    // profile URL handle (LinkedIn /in/jackson-jesionowski → "Jackson
    // Jesionowski"). Still allow blank name — the server will fall back to
    // email-local-part or handle when generating the slug.
    const name = typed || derived_name || "";
    if (!name && !email && !phone && !profile_url) return;
    setEntries((prev) => [...prev, { name, email, phone, profile_url }]);
    setEntryName("");
    setEntryContact("");
  }

  async function generatePersonalized() {
    // Prefer the rich entries list; fall back to plain email list for backward compat.
    const contacts =
      entries.length > 0
        ? entries
        : emails.map((e) => ({ email: e }));
    if (contacts.length === 0) {
      setGenError(
        "Add at least one name+email above, or import a CSV first."
      );
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const r = await fetch("/api/bulk-create-invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contacts
        })
      });
      const j = await r.json();
      if (j.error) {
        setGenError(j.detail || j.error);
        return;
      }
      setPersonalized(j.results ?? []);
    } catch {
      setGenError("Couldn't reach the server.");
    } finally {
      setGenerating(false);
    }
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
      label: "Import LinkedIn CSV",
      onClick: () => setImportHelp("linkedin"),
      note:
        "export your connections from LinkedIn → upload here → we make a custom URL per person."
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
      label: "Import Google Contacts CSV",
      onClick: () => setImportHelp("google"),
      note:
        "export contacts from Google → upload here → we make a custom URL per person."
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

      {/* People list — (name, email) per row + inline CSV import */}
      <div className="mt-5 retro-panel p-4">
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          who do you want to invite?
        </div>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--text-dim)" }}
        >
          Full name + whatever you have for them: email, phone, or a
          LinkedIn / X / Instagram / Facebook profile URL. We scrape the
          profile, pick the right person, and generate a custom landing page.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Full name"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            className="retro-input text-sm"
            style={{ flex: "2 1 160px", minWidth: 0 }}
          />
          <input
            type="text"
            placeholder="email, phone, or linkedin.com/in/…"
            value={entryContact}
            onChange={(e) => setEntryContact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            className="retro-input text-sm"
            style={{ flex: "3 1 240px", minWidth: 0 }}
          />
          <button
            type="button"
            onClick={addEntry}
            disabled={!entryName.trim() && !entryContact.trim()}
            className="retro-btn retro-btn-primary text-sm"
          >
            + add
          </button>
          <label
            className="retro-btn text-sm cursor-pointer"
            title="Import a CSV (Gmail / LinkedIn / Google export). We extract names + emails."
          >
            import .csv
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onCsv}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {entries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entries.map((c, i) => (
              <span
                key={`${c.email || c.name}-${i}`}
                className="retro-panel text-xs inline-flex items-center gap-2"
                style={{
                  padding: "4px 8px",
                  borderColor: "var(--border)"
                }}
              >
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {c.name || "(no name)"}
                </span>
                {c.email && (
                  <span style={{ color: "var(--text-dim)" }}>{c.email}</span>
                )}
                {c.phone && !c.email && (
                  <span style={{ color: "var(--text-dim)" }}>{c.phone}</span>
                )}
                {c.profile_url && !c.email && !c.phone && (
                  <a
                    href={c.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--amber-bright)",
                      textDecoration: "underline",
                      fontSize: 11
                    }}
                  >
                    {profileLabel(c.profile_url)}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setEntries((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="retro-dim hover:text-white"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setEntries([])}
              className="text-xs retro-dim hover:text-white"
              style={{ marginLeft: 6 }}
            >
              clear all
            </button>
          </div>
        )}

        {emails.length > 0 && entries.length === 0 && (
          <div className="mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
            CSV loaded {emails.length} email{emails.length === 1 ? "" : "s"}.
            They&apos;ll be used for bulk-bcc + personalized invites below.
            <button
              type="button"
              onClick={() => setEmails([])}
              className="ml-2 retro-dim hover:text-white"
            >
              clear
            </button>
          </div>
        )}

        {csvError && (
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--red)" }}
          >
            {csvError}
          </p>
        )}

        {/* Inline generate CTA — sits directly under the entries list so
            the user's eye doesn't have to jump past the channel grid to
            the bottom of the page. Disabled until at least one entry. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generatePersonalized}
            disabled={
              generating || (entries.length === 0 && emails.length === 0)
            }
            className="retro-btn retro-btn-primary text-sm"
          >
            {generating
              ? "generating…"
              : `+ generate ${
                  entries.length || emails.length || ""
                } personalized invite${
                  (entries.length || emails.length) === 1 ? "" : "s"
                }`}
          </button>
          {entries.length === 0 && emails.length === 0 && (
            <span
              className="text-xs"
              style={{ color: "var(--text-dim)" }}
            >
              add a name + email/phone above
            </span>
          )}
        </div>
        {genError && (
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--red)" }}
          >
            {genError}
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

      {/* Personalized invite slugs — one custom landing page per contact */}
      <div
        className="mt-4 retro-panel"
        style={{
          padding: 16,
          borderColor: "var(--amber)"
        }}
      >
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          personalized invites · one custom landing page per contact
        </div>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--text-dim)" }}
        >
          For each imported contact we generate a custom URL like
          syncedin.org/their-name with a personalized opening message from
          your twin. Much higher click-through than a generic invite.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={generatePersonalized}
            disabled={generating || emails.length === 0}
            className="retro-btn retro-btn-primary text-sm"
          >
            {generating
              ? "generating…"
              : `+ generate ${emails.length || ""} personalized invites`}
          </button>
          {emails.length === 0 && (
            <span
              className="text-xs"
              style={{ color: "var(--text-dim)" }}
            >
              import emails above first
            </span>
          )}
        </div>
        {genError && (
          <p
            className="text-xs mt-2"
            style={{ color: "var(--red)" }}
          >
            {genError}
          </p>
        )}

        {personalized.length > 0 && (
          <div className="mt-4">
            <div
              className="text-xs mb-2"
              style={{ color: "var(--text-dim)" }}
            >
              {personalized.length} personalized invite{personalized.length === 1 ? "" : "s"} ready. Each row has a "send via" button that opens iMessage/Gmail/Email with the personalized link prefilled.
            </div>
            <button
              type="button"
              onClick={() => {
                const all = personalized
                  .map(
                    (p) =>
                      `${p.contact.name}${p.contact.email ? " <" + p.contact.email + ">" : ""}: ${p.url}`
                  )
                  .join("\n");
                copy(all, "all personalized links");
              }}
              className="retro-btn text-sm mb-3"
            >
              copy all as list
            </button>
            <ul className="space-y-2">
              {personalized.map((p) => (
                <li
                  key={p.slug}
                  className="retro-panel"
                  style={{ padding: 10 }}
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="font-semibold text-sm"
                        style={{ color: "var(--text)" }}
                      >
                        {p.contact.name}
                        {p.contact.email && (
                          <span
                            className="text-xs ml-2"
                            style={{ color: "var(--text-dim)" }}
                          >
                            {p.contact.email}
                          </span>
                        )}
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                        style={{
                          color: "var(--amber-bright)",
                          wordBreak: "break-all"
                        }}
                      >
                        {p.url}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => copy(p.url, "link")}
                        className="retro-btn text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        copy link
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copy(`${p.starter}\n\n${p.url}`, "message")
                        }
                        className="retro-btn text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        copy msg
                      </button>
                      <a
                        href={`sms:?&body=${encodeURIComponent(
                          `${p.starter}\n\n${p.url}`
                        )}`}
                        className="retro-btn text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        💬 SMS
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `${p.starter}\n\n${p.url}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="retro-btn text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        🟢 WA
                      </a>
                      <a
                        href={`https://signal.me/#p/?text=${encodeURIComponent(
                          `${p.starter}\n\n${p.url}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="retro-btn text-xs"
                        style={{ padding: "5px 10px" }}
                        title="Signal works best from desktop with Signal Desktop installed."
                      >
                        🔒 Signal
                      </a>
                      {p.contact.email && (
                        <a
                          href={`mailto:${p.contact.email}?subject=${encodeURIComponent(
                            "An invite from " + appUrl
                          )}&body=${encodeURIComponent(`${p.starter}\n\n${p.url}`)}`}
                          className="retro-btn text-xs"
                          style={{ padding: "5px 10px" }}
                        >
                          ✉️ Email
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Import-help panel — shows when LinkedIn or Google Contacts CSV is clicked */}
      {importHelp && (
        <div className="mt-4 retro-panel p-4" style={{ borderColor: "var(--amber)" }}>
          <div className="flex items-start justify-between gap-3">
            <div
              className="retro-label"
              style={{ color: "var(--amber-bright)" }}
            >
              {importHelp === "linkedin"
                ? "import linkedin connections"
                : "import google contacts"}
            </div>
            <button
              type="button"
              onClick={() => setImportHelp(null)}
              className="retro-dim hover:text-white text-xs"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {importHelp === "linkedin" ? (
            <ol
              className="mt-3 text-xs space-y-1.5"
              style={{ color: "var(--text-dim)" }}
            >
              <li>
                1. Open{" "}
                <a
                  href="https://www.linkedin.com/mypreferences/d/download-my-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--amber-bright)" }}
                >
                  LinkedIn → Settings → Get a copy of your data
                </a>
                .
              </li>
              <li>
                2. Check &quot;Connections&quot;. Request archive (usually
                ready in 10 minutes; email when done).
              </li>
              <li>
                3. Unzip → find <code>Connections.csv</code> → drop it into
                the &quot;import .csv&quot; button above.
              </li>
              <li>
                4. We pull every name + email and generate a personalized
                landing page for each.
              </li>
            </ol>
          ) : (
            <ol
              className="mt-3 text-xs space-y-1.5"
              style={{ color: "var(--text-dim)" }}
            >
              <li>
                1. Open{" "}
                <a
                  href="https://contacts.google.com/?hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--amber-bright)" }}
                >
                  Google Contacts
                </a>
                .
              </li>
              <li>
                2. Top-left menu → &quot;Export&quot; → All contacts →
                &quot;Google CSV&quot;.
              </li>
              <li>
                3. Drop the downloaded <code>contacts.csv</code> into the
                &quot;import .csv&quot; button above.
              </li>
              <li>
                4. Every contact gets a personalized URL like{" "}
                <code>syncedin.org/their-name</code> with a custom opener.
              </li>
            </ol>
          )}
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
