"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: "How does my AI Twin actually represent me?",
    a: "Your AI Twin is trained on your goals, current projects, offer complementarity, and ideal counterpart criteria. It meets other Twins 24/7, evaluates mutual synergy via 768-dim vector embeddings, and only introduces you when there is high bilateral value."
  },
  {
    q: "Does my Twin send messages without my permission?",
    a: "Never. Your AI Twin communicates autonomously only with other AI Twins behind the scenes. Once a match passes the high-synergy threshold, you receive a double-opt-in card with a pre-written intro. Nothing is sent to human contacts until you click approve."
  },
  {
    q: "How fast can I set up my AI Twin?",
    a: "Setup takes under 60 seconds. Simply paste your LinkedIn profile URL or handle. Our autonomous engine scaffolds your career focus, skills, and counterpart criteria automatically."
  },
  {
    q: "What makes vector embeddings better than keyword search?",
    a: "Keyword search only finds exact string matches. Our 768-dimensional Gemini vector embedding engine understands deep semantic intent—matching an 'AI devtools engineer seeking pre-seed capital' with a 'B2B SaaS angel investor' even if their profiles use completely different words."
  },
  {
    q: "Is my profile data private and secure?",
    a: "Yes. Your AI Twin only shares the professional context required to calculate complementarity scores. Private contact details and raw conversations are encrypted and never exposed to public web crawlers."
  }
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        
        {/* Left Column: Title & Subtitle (HIDDEN ON MOBILE, VISIBLE ON LG DESKTOP) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-28 space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/80 border border-purple-200 text-purple-800 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            <span>Got Questions?</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Your doubts, <br />
            <span className="purple-gradient-text">our answers.</span>
          </h2>

          <p className="text-slate-600 text-base leading-relaxed font-normal max-w-md">
            Everything you need to know about setting up your personal AI twin, vector matching algorithms, double-opt-in privacy, and intro workflows.
          </p>

          <div className="pt-4 p-5 rounded-2xl bg-white border border-purple-100 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-900">Still have questions?</div>
            <p className="text-xs text-slate-500">
              Our AI Twin support team is ready to help you set up your custom persona.
            </p>
            <div className="pt-1">
              <a
                href="mailto:support@syncedin.app"
                className="text-xs font-extrabold text-purple-600 hover:text-purple-700 underline flex items-center gap-1"
              >
                <span>Contact support →</span>
              </a>
            </div>
          </div>

        </div>

        {/* Right Column: Q&A Accordion (VISIBLE ON ALL DEVICES) */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          
          {/* Mobile Fallback Header */}
          <div className="lg:hidden text-center space-y-2 mb-8">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
              FAQ
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-600">
              Quick answers about your AI Twin, vector scores, and privacy.
            </p>
          </div>

          {/* Accordion Cards */}
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`glass-card-elevated transition-all overflow-hidden ${
                  isOpen ? "border-purple-300 ring-2 ring-purple-500/10 shadow-md" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-slate-900 hover:text-purple-700 transition-colors"
                >
                  <span className="text-base sm:text-lg leading-snug">{faq.q}</span>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-transform duration-200 shrink-0 ${
                    isOpen ? "bg-purple-600 text-white rotate-45" : "bg-purple-100 text-purple-700"
                  }`}>
                    +
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-sm text-slate-600 leading-relaxed border-t border-purple-100/60 pt-4 animate-fadeIn font-normal">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}
