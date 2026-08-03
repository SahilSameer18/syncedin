# SyncdIn: Complete Project Structure Report

### High-Level Folder Structure (518 Tracked Files Total)
```text
SyncdIn Root/
├── android/            (56 files)
├── app/                (312 files)
├── docs/               (3 files)
├── fastlane/           (4 files)
├── ios/                (18 files)
├── lib/                (33 files)
├── public/             (46 files)
├── scripts/            (17 files)
├── supabase/           (7 files)
└── [Root Config Files] (22 files)
```

Here is the exhaustive map of the repository, separated by core architectural domains. *(Hidden git files and `node_modules` are excluded to give you a clean view of the actual source code.)*

---

## 💻 1. Frontend & API Routes (`app/`) (312 files)
This is the Next.js App Router directory. It contains all UI components, pages, and API endpoints.

```text
app/
├── (verticals)/...
├── admin/...
├── api/
│   ├── ai-exports/route.ts
│   ├── community-match/route.ts
│   ├── cron/...
│   ├── demo-conversation/route.ts
│   ├── dm/...
│   ├── error-report/route.ts
│   ├── process-invites/route.ts
│   ├── profile-preview-match/route.ts
│   ├── ...
├── conversations/
│   ├── [id]/...
│   └── new/...
├── dashboard/...
├── dm/
│   └── [handle]/...
├── invite/
│   ├── loading.tsx
│   └── page.tsx
├── layout.tsx
├── page.tsx
├── ... (and dozens of other route folders like /login, /messages, /onboarding, /twin, /u)
```

## 🧠 2. The Core "Brain" (`lib/`) (33 files)
This is where the agentic logic, matchmaking algorithms, database helpers, and AI system prompts live.

```text
lib/
├── ai-exports.ts
├── anthropic.ts
├── context-dive.ts
├── dm-twin-prompt.ts
├── exa.ts
├── gemini.ts
├── matchmaking.ts
├── scoring.ts
├── scrape.ts
├── supabase/
│   ├── client.ts
│   └── server.ts
├── sync-score-prompt.ts
├── twin-prompt.ts
├── twin-tools.ts
└── types.ts
```

## 🗄️ 3. Database Layer (`supabase/`) (7 files)
The raw PostgreSQL schema and historical migrations.

```text
supabase/
├── email-template-magic-link.html
├── migrations/
│   ├── 0001_email_events.sql
│   ├── 0002_conference_host_brief.sql
│   ├── 0003_funnel_events_win_receipts.sql
│   ├── 0004_push_tokens.sql
│   └── 0005_edit_magnitude.sql
└── schema.sql
```

## 📱 4. Mobile Wrappers (`ios/` & `android/`) (74 files combined)
The Capacitor configurations that wrap the Next.js web app into native iOS and Android applications.

```text
android/ (56 files)
├── ... (Java/Kotlin Gradle configuration)

ios/ (18 files)
├── App/
│   ├── App.xcodeproj/...
│   ├── App.xcworkspace/...
│   ├── AppDelegate.swift
│   ├── Info.plist
│   └── Podfile
```

## 🛠️ 5. Scripts & Tooling (`scripts/` & `fastlane/`) (21 files combined)
Automation scripts for deployments, bootstrapping, and database migrations.

```text
scripts/ (17 files)
├── android-release-setup.sh
├── cap-bootstrap.sh
├── deploy.sh
├── generate-app-icons.mjs
├── migrate.sh
├── seed-test-personas.mjs
└── ship-it.sh

fastlane/ (4 files)
├── Appfile
├── Fastfile
└── Pluginfile
```

## 🎨 6. Static Assets (`public/` & `docs/`) (49 files combined)
Images, icons, manifest files, and promotional videos.

```text
public/ (46 files)
├── app-icons/
│   ├── android/...
│   └── ios/...
├── play-assets/...
├── social/
│   ├── syncedin-preview-small.mp4
│   └── syncedin-preview.gif
├── manifest.json
└── syncedin-wordmark.png

docs/ (3 files)
├── CICD_SECRETS.md
├── SYNCEDIN_TRAILER.md
└── onboarding-variants.md
```

## ⚙️ 7. Configuration Files (Root) (22 files)
```text
.env.example
.env.local
capacitor.config.ts
middleware.ts
next.config.js
package.json
postcss.config.js
tailwind.config.ts
tsconfig.json
vercel.json
...
```
