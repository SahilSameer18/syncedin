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
  // Default broadcast copy — replaced on mount with a twin-voice version
  // from /api/twin-broadcast-message so every channel (iMessage, WhatsApp,
  // Email, Tweet, Reddit, ...) sends a message that actually sounds like
  // the inviter, not generic platform boilerplate.
  const defaultMessage = `I'm on SyncedIn — an agent-to-agent protocol where two people's digital twins talk to each other and find the highest win-win between them. Worth 90 seconds. Join me: ${appUrl}`;
  const defaultTweet = `Two digital twins, one win-win.\n\nJust joined SyncedIn — your clone talks to my clone, surfaces the deal, you walk in already knowing. ${appUrl}`;
  const [inviteMessage, setInviteMessage] = useState<string>(defaultMessage);
  const [inviteTweet, setInviteTweet] = useState<string>(defaultTweet);
  const [voiceMode, setVoiceMode] = useState<"loading" | "twin" | "default">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    // Cache for the session so navigating between tabs doesn't refire Claude.
    const cached =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("syncedin.twinBroadcastMsg")
        : null;
    if (cached) {
      try {
        const j = JSON.parse(cached);
        if (j?.message) setInviteMessage(j.message);
        if (j?.tweet) setInviteTweet(j.tweet);
        if (j?.voice) setVoiceMode(j.voice);
        return;
      } catch {
        /* fall through to fetch */
      }
    }
    fetch("/api/twin-broadcast-message")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.message) setInviteMessage(j.message);
        if (j?.tweet) setInviteTweet(j.tweet);
        setVoiceMode(j?.voice === "twin" ? "twin" : "default");
        try {
          sessionStorage.setItem(
            "syncedin.twinBroadcastMsg",
            JSON.stringify(j)
          );
        } catch {
          /* private mode */
        }
      })
      .catch(() => {
        if (!cancelled) setVoiceMode("default");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Rotating placeholder for the contact field — cycles real-looking
  // examples from each supported platform so the input demonstrates
  // multi-platform support without static "or, or, or" copy. Pauses
  // rotation when the user is typing or the field has focus.
  const CONTACT_EXAMPLES = [
    "linkedin.com/in/lucas-chu",
    "x.com/jackjayio",
    "instagram.com/jackjay.io",
    "facebook.com/zuck",
    "alex@example.com",
    "+1 415 555 0142"
  ];
  const [examplePos, setExamplePos] = useState(0);
  const [contactFocused, setContactFocused] = useState(false);
  useEffect(() => {
    if (entryContact.length > 0 || contactFocused) return;
    const t = setInterval(() => {
      setExamplePos((i) => (i + 1) % CONTACT_EXAMPLES.length);
    }, 2200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryContact.length === 0, contactFocused]);

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

  // Persistence — the personalized list survives reloads. The user
  // generates invites, walks away, comes back tomorrow; the row is
  // still there with the link + "send via" buttons until they
  // explicitly tick "✓ invite sent". Then it's removed from the visible
  // list. Storage key is intentionally non-user-scoped because we don't
  // know the user id in this client component; collisions across logged-
  // in users on the same browser are unlikely + low-risk.
  const STORAGE_KEY = "syncedin.personalizedInvites.v1";
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPersonalized(parsed);
      }
    } catch {
      /* corrupted storage — ignore */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personalized));
    } catch {
      /* quota / private mode */
    }
  }, [personalized, hydrated]);

  /** Remove a single personalized invite from the visible list +
   *  persisted storage. Triggered by the "✓ invite sent" button on
   *  each row. The actual pending_invites DB row stays — only the
   *  client-side reminder is cleared. */
  function markInviteSent(slug: string) {
    setPersonalized((prev) => prev.filter((p) => p.slug !== slug));
  }

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

  // Parse LinkedIn / Google CSV imports into structured entries.
  // LinkedIn's official Connections.csv has columns:
  //   First Name, Last Name, URL, Email Address, Company, Position, Connected On
  // (sometimes with a "Notes:" preamble at the top — skip rows until we hit
  // the header.) We pull Name + URL + Email so every connection lands as a
  // proper entry with a profile_url, which the scraper chain can then
  // personalize against. Falls back to the old email-regex behavior when
  // the file doesn't look like a structured CSV.
  function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/);

      // Find the header row.
      let headerIdx = -1;
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const lower = lines[i].toLowerCase();
        if (
          (lower.includes("first name") ||
            lower.includes("given name") ||
            lower.includes("name")) &&
          (lower.includes("url") ||
            lower.includes("email") ||
            lower.includes("profile"))
        ) {
          headerIdx = i;
          break;
        }
      }

      // Simple comma-aware CSV row splitter (handles double-quoted fields).
      const splitRow = (row: string): string[] => {
        const out: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const c = row[i];
          if (c === '"') {
            if (inQuotes && row[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (c === "," && !inQuotes) {
            out.push(cur);
            cur = "";
          } else {
            cur += c;
          }
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };

      // Structured-CSV path.
      if (headerIdx !== -1) {
        const header = splitRow(lines[headerIdx]).map((h) =>
          h.toLowerCase().replace(/^"|"$/g, "")
        );
        const idxOf = (...names: string[]) =>
          header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
        const firstNameIdx = idxOf("first name", "given name");
        const lastNameIdx = idxOf("last name", "family name", "surname");
        const fullNameIdx = idxOf("name");
        const urlIdx = idxOf("url", "profile url", "profile");
        const emailIdx = idxOf("email address", "email");
        const companyIdx = idxOf("company", "organization");

        const newEntries: Array<{
          name: string;
          email?: string;
          profile_url?: string;
        }> = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
          const raw = lines[i];
          if (!raw.trim()) continue;
          const cells = splitRow(raw);
          const fn =
            firstNameIdx >= 0 ? cells[firstNameIdx] || "" : "";
          const ln = lastNameIdx >= 0 ? cells[lastNameIdx] || "" : "";
          const full =
            fullNameIdx >= 0 && firstNameIdx === -1
              ? cells[fullNameIdx] || ""
              : "";
          const name = (
            [fn, ln].filter(Boolean).join(" ").trim() || full.trim()
          );
          const url = urlIdx >= 0 ? cells[urlIdx] || "" : "";
          const email = emailIdx >= 0 ? cells[emailIdx] || "" : "";
          // Need at least a name+url OR a name+email to be useful.
          if (!name && !email && !url) continue;
          newEntries.push({
            name,
            email: email ? email.toLowerCase() : undefined,
            profile_url:
              url && /^https?:\/\//i.test(url) ? url : undefined
          });
        }

        if (newEntries.length > 0) {
          setEntries((prev) => {
            const seen = new Set(
              prev.map((p) => `${p.name}|${p.email || ""}|${p.profile_url || ""}`)
            );
            const merged = [...prev];
            for (const e of newEntries) {
              const k = `${e.name}|${e.email || ""}|${e.profile_url || ""}`;
              if (!seen.has(k)) {
                seen.add(k);
                merged.push(e);
              }
            }
            return merged;
          });
          flash(`+${newEntries.length} contacts`);
          e.target.value = "";
          return;
        }
      }

      // Fallback: plain regex sweep for emails (old behavior).
      const found = Array.from(
        text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      ).map((m) => m[0].toLowerCase());
      if (found.length === 0) {
        setCsvError(
          "Couldn't find name+URL columns or emails in that file. Expected the LinkedIn 'Connections.csv' or a similar structured export."
        );
      } else {
        setEmails((prev) => Array.from(new Set([...prev, ...found])));
        flash(`+${found.length} emails`);
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  // Pending set — entries currently being generated. Used to show
  // "generating…" rows in the personalized list while the API is in
  // flight so the user has immediate feedback after each add.
  const [pendingNames, setPendingNames] = useState<string[]>([]);

  /**
   * Fire bulk-create-invites for an arbitrary list of contacts. Used by:
   *   - addEntry()         → auto-fires for the single contact just added
   *   - CSV import path    → fires for all imported rows
   *   - manual button      → fires for whatever's in `entries` (rare now,
   *                          mostly relevant if auto-generate failed and
   *                          the user wants a retry)
   * Results append to the personalized list. Each contact moves through
   * pendingNames so the UI can show its "generating" state.
   */
  async function generateForContacts(
    contacts: Array<{
      name: string;
      email?: string;
      phone?: string;
      profile_url?: string;
    }>
  ) {
    if (contacts.length === 0) return;
    setGenError(null);
    setPendingNames((prev) => [
      ...prev,
      ...contacts.map((c) => c.name || c.email || c.phone || "anon")
    ]);
    setGenerating(true);
    try {
      const r = await fetch("/api/bulk-create-invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contacts })
      });
      const j = await r.json();
      if (j.error) {
        setGenError(j.detail || j.error);
        return;
      }
      setPersonalized((prev) => [...prev, ...(j.results ?? [])]);
    } catch {
      setGenError("Couldn't reach the server.");
    } finally {
      setGenerating(false);
      setPendingNames((prev) =>
        prev.filter(
          (n) =>
            !contacts.some(
              (c) => (c.name || c.email || c.phone || "anon") === n
            )
        )
      );
    }
  }

  function addEntry() {
    const typed = entryName.trim();
    const { email, phone, profile_url, derived_name } =
      classifyContact(entryContact);
    // Name policy:
    //   - Profile URL: name is optional. We auto-derive from the URL handle,
    //     and the server scrapes the page for the rest of the context.
    //   - Email or phone: name IS required, because we have no other way to
    //     identify the person — we'll fall back to an Exa name-search to
    //     gather context for the opener.
    const name = typed || derived_name || "";
    if (!email && !phone && !profile_url) return;
    if ((email || phone) && !profile_url && !name) {
      // refuse silently — the placeholder copy already tells the user
      // a name is required when there's no profile URL to derive from.
      return;
    }
    const newEntry = { name, email, phone, profile_url };
    setEntries((prev) => [...prev, newEntry]);
    setEntryName("");
    setEntryContact("");
    // AUTO-GENERATE the personalized invite for this single entry the
    // moment it's added. No "+ generate" click required — the result
    // streams into the personalized panel below within a few seconds.
    generateForContacts([newEntry]);
  }

  // Live classification of whatever's currently typed in the contact field
  // — drives the dynamic "Full name (optional)" / "Full name (required)"
  // label on the name input.
  const liveClassified = classifyContact(entryContact);
  const nameIsOptional = !!liveClassified.profile_url;

  // Kept as a manual retry / batch path (e.g., after CSV import or a
  // failed auto-generate). The primary flow is auto-fire from addEntry.
  async function generatePersonalized() {
    const contacts =
      entries.length > 0
        ? entries
        : emails.map((e) => ({ email: e, name: "" }));
    if (contacts.length === 0) {
      setGenError(
        "Add at least one name+email above, or import a CSV first."
      );
      return;
    }
    await generateForContacts(contacts);
    setEntries([]);
    setEmails([]);
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
        inviteTweet
      )}`,
      note:
        voiceMode === "twin"
          ? "tweet drafted in your twin's voice — broadcast to your X followers."
          : "broadcast to your X followers."
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
          Drop a{" "}
          <PlatformChip name="LinkedIn" domain="linkedin.com" /> ·{" "}
          <PlatformChip name="X" domain="x.com" /> ·{" "}
          <PlatformChip name="Instagram" domain="instagram.com" /> ·{" "}
          <PlatformChip name="Facebook" domain="facebook.com" /> URL and
          we&apos;ll scrape the rest — no name needed. For an email or
          phone, add the name so we can look the person up.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={
              nameIsOptional
                ? "Full name (optional — we'll derive it)"
                : entryContact.trim()
                ? "Full name (required for email / phone)"
                : "Full name"
            }
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            className="retro-input text-sm"
            style={{ flex: "2 1 160px", minWidth: 0 }}
          />
          <input
            type="text"
            placeholder={CONTACT_EXAMPLES[examplePos]}
            value={entryContact}
            onChange={(e) => setEntryContact(e.target.value)}
            onFocus={() => setContactFocused(true)}
            onBlur={() => setContactFocused(false)}
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

      {/* Personalized invite results — placed ABOVE the broadcast grid so the
          high-fidelity path is what the user sees first. Each row is a custom
          landing page generated with a twin-voice opener that references real
          context scraped from the recipient's social profile. */}
      {(personalized.length > 0 || pendingNames.length > 0) && (
        <div
          className="mt-5 retro-panel"
          style={{ padding: 16, borderColor: "var(--amber)" }}
        >
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            personalized invites · {personalized.length} custom landing page
            {personalized.length === 1 ? "" : "s"}
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-dim)" }}
          >
            Each contact has a unique URL with a twin-voice opener that
            references their profile. Click-through is dramatically higher
            than the broadcast options below.
          </p>
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
            className="mt-3"
            style={{
              fontSize: 10,
              padding: "3px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              letterSpacing: "0.04em"
            }}
            title="Copy every personalized link as a plain-text list"
          >
            copy all as list
          </button>
          <ul className="mt-3 space-y-2">
            {/* In-flight rows — render a placeholder for each contact
                still generating so the user sees instant feedback after
                pressing + add. */}
            {pendingNames.map((n) => (
              <li
                key={`pending-${n}`}
                className="retro-panel"
                style={{
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderColor: "var(--amber)"
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: "var(--amber-bright)",
                    boxShadow: "0 0 8px var(--amber-bright)",
                    animation: "sg-pulse 1.2s ease-in-out infinite"
                  }}
                />
                <div className="text-sm" style={{ color: "var(--text)" }}>
                  Generating personalized invite for{" "}
                  <span className="font-semibold">{n}</span>…
                </div>
              </li>
            ))}
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
                    {/* "✓ invite sent" — the explicit dismiss. Removes
                        this row from the personalized list + localStorage
                        so the user can track what they've actually sent
                        without losing the result panel between sessions. */}
                    <button
                      type="button"
                      onClick={() => markInviteSent(p.slug)}
                      className="retro-btn text-xs"
                      style={{
                        padding: "5px 10px",
                        borderColor: "var(--green, #3cd870)",
                        color: "var(--green, #3cd870)"
                      }}
                      title="Mark this invite as sent and remove from the list"
                    >
                      ✓ invite sent
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Channel grid — clearly framed as the LOWER-FIDELITY path now that
          the personalized invites are above. Same message broadcast to many,
          rendered in the user's twin voice rather than the platform default. */}
      <div className="mt-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="retro-label"
            style={{ color: "var(--text-dim)" }}
          >
            or — broadcast the same message
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-dim)" }}
          >
            {voiceMode === "twin"
              ? "Drafted in your twin's voice. Same copy to everyone — fast, lower fidelity than personalized."
              : voiceMode === "loading"
              ? "Loading your twin's voice…"
              : "Generic invite copy. Add more to your twin to get a voice-customized version."}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

      {/* (Personalized invite results render in the panel above the broadcast
          grid — no duplicate block here.) */}

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

/**
 * PlatformChip — inline favicon + name pill used in the "Drop a..." intro
 * copy. Uses Google's favicon CDN so we don't have to host four logo files,
 * and the chip scales perfectly with whatever font-size it inherits.
 */
function PlatformChip({
  name,
  domain
}: {
  name: string;
  domain: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 6px 1px 3px",
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        verticalAlign: "baseline",
        lineHeight: 1.3
      }}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={12}
        height={12}
        style={{
          borderRadius: 2,
          display: "inline-block",
          flexShrink: 0
        }}
        loading="lazy"
      />
      <span style={{ fontWeight: 700, color: "var(--text)" }}>{name}</span>
    </span>
  );
}
