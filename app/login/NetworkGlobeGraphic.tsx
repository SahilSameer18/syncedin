"use client";

export function NetworkGlobeGraphic() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none select-none">
      
      {/* Radial Glow */}
      <div className="absolute w-[420px] h-[420px] bg-purple-600/30 rounded-full blur-3xl" />
      <div className="absolute w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-2xl" />

      {/* SVG World Globe Sphere & Interconnected Nodes */}
      <svg className="w-full max-w-md h-auto relative z-10" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
        
        {/* Globe Grid Lines */}
        <circle cx="250" cy="250" r="180" stroke="rgba(168, 85, 247, 0.25)" strokeWidth="1.5" strokeDasharray="4 4" />
        <ellipse cx="250" cy="250" rx="180" ry="70" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="1.5" />
        <ellipse cx="250" cy="250" rx="70" ry="180" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="1.5" />
        <ellipse cx="250" cy="250" rx="180" ry="120" stroke="rgba(168, 85, 247, 0.15)" strokeWidth="1" />
        <line x1="70" y1="250" x2="430" y2="250" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="1.5" />

        {/* Pulsing Interconnected Connection Beams */}
        <path d="M140 180 Q250 120 360 210" stroke="url(#gradient1)" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
        <path d="M160 300 Q260 380 340 280" stroke="url(#gradient2)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M200 130 Q300 250 180 340" stroke="url(#gradient1)" strokeWidth="2" strokeDasharray="6 6" />

        {/* Gradients */}
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Global Node 1: San Francisco (Founder) */}
        <g transform="translate(140, 180)">
          <circle r="12" fill="rgba(168, 85, 247, 0.2)" />
          <circle r="6" fill="#a855f7" />
          <circle r="3" fill="#ffffff" />
        </g>

        {/* Global Node 2: London (Investor) */}
        <g transform="translate(360, 210)">
          <circle r="14" fill="rgba(16, 185, 129, 0.2)" />
          <circle r="7" fill="#10b981" />
          <circle r="3.5" fill="#ffffff" />
        </g>

        {/* Global Node 3: Bangalore (Engineer) */}
        <g transform="translate(340, 280)">
          <circle r="12" fill="rgba(99, 102, 241, 0.2)" />
          <circle r="6" fill="#6366f1" />
          <circle r="3" fill="#ffffff" />
        </g>

        {/* Global Node 4: Tokyo (AI Researcher) */}
        <g transform="translate(160, 300)">
          <circle r="10" fill="rgba(244, 63, 94, 0.2)" />
          <circle r="5" fill="#f43f5e" />
        </g>

        {/* Floating AI Match Badges */}
        <foreignObject x="220" y="110" width="100" height="40">
          <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-purple-500/40 text-[10px] font-black text-emerald-400 shadow-xl flex items-center gap-1 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>94% FIT</span>
          </div>
        </foreignObject>

        <foreignObject x="240" y="320" width="100" height="40">
          <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-indigo-500/40 text-[10px] font-black text-purple-300 shadow-xl flex items-center gap-1 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>91% FIT</span>
          </div>
        </foreignObject>

      </svg>

    </div>
  );
}
