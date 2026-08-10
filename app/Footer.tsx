"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";

const HIDE_ON: Array<string | RegExp> = [
  /^\/conversations(?:\/|$)/,
  /^\/messages(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/talk(?:\/|$)/,
  /^\/twin(?:\/|$)/,
  /^\/chat(?:\/|$)/,
  /^\/login(?:\/|$)/
];

function shouldHide(path: string): boolean {
  return HIDE_ON.some((p) =>
    typeof p === "string" ? path === p : p.test(path)
  );
}

export function Footer() {
  const path = usePathname() || "";
  if (shouldHide(path)) return null;

  return (
    <footer className="w-full border-t border-purple-100 bg-white/80 backdrop-blur-lg mt-16 text-slate-600">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <Wordmark width={120} height={28} />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                Network Active
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              SyncedIn is the personal AI networking agent that filters profiles, evaluates mutual leverage, and introduces you to people genuinely worth your time.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-sm font-medium">
              <li><Link href="/match-lab" className="hover:text-purple-600 transition-colors">Match Lab</Link></li>
              <li><Link href="/twin" className="hover:text-purple-600 transition-colors">AI Twin Studio</Link></li>
              <li><Link href="/conferences/demo" className="hover:text-purple-600 transition-colors">Private Rooms</Link></li>
              <li><Link href="/wins" className="hover:text-purple-600 transition-colors">Wins & Deals</Link></li>
            </ul>
          </div>

          {/* Resources Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2 text-sm font-medium">
              <li><Link href="/hypernetwork" className="hover:text-purple-600 transition-colors">Hypernetwork Stats</Link></li>
              <li><Link href="/feedback" className="hover:text-purple-600 transition-colors">Community Feedback</Link></li>
              <li><Link href="/support" className="hover:text-purple-600 transition-colors">Help & Support</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-sm font-medium">
              <li><Link href="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/child-safety" className="hover:text-purple-600 transition-colors">Safety Standards</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 mt-10 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <div>
            © {new Date().getFullYear()} SyncedIn. All rights reserved.
          </div>
          <div>
            Powered by Gemini 768-dim AI Vector Engine
          </div>
        </div>
      </div>
    </footer>
  );
}
