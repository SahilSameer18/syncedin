"use client";

import { useEffect, useRef, useState } from "react";

type Node = {
  x: number;
  y: number;
  z: number;
  label: string;
  city: string;
  lat: number;
  lng: number;
};

const CITIES: Array<{ name: string; lat: number; lng: number }> = [
  { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { name: "New Delhi", lat: 28.6139, lng: 77.209 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Berlin", lat: 52.52, lng: 13.405 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 }
];

export function GlobeHeroVisual() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeMatch, setActiveMatch] = useState(0);

  const matches = [
    {
      user1: "Sahil (New Delhi)",
      user2: "Sarah (San Francisco)",
      score: "96%",
      reason: "Matched on Agentic AI Evals & LLM Infra"
    },
    {
      user1: "Alex (London)",
      user2: "Elena (Berlin)",
      score: "94%",
      reason: "Matched for Series A Co-founder role"
    },
    {
      user1: "Kenji (Tokyo)",
      user2: "Marcus (New York)",
      score: "92%",
      reason: "Matched on B2B SaaS Enterprise intros"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveMatch((prev) => (prev + 1) % matches.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [matches.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let rotationY = 0;

    // Convert lat/lng to 3D sphere points
    const radius = 140;
    const nodes: Node[] = CITIES.map((c) => {
      const phi = (90 - c.lat) * (Math.PI / 180);
      const theta = (c.lng + 180) * (Math.PI / 180);
      return {
        x: -(radius * Math.sin(phi) * Math.cos(theta)),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
        label: c.name,
        city: c.name,
        lat: c.lat,
        lng: c.lng
      };
    });

    // Generate latitude / longitude grid dots
    const dots: Array<{ x: number; y: number; z: number }> = [];
    const numLats = 18;
    const numLngs = 36;
    for (let i = 0; i <= numLats; i++) {
      const lat = -90 + (180 / numLats) * i;
      const phi = (90 - lat) * (Math.PI / 180);
      for (let j = 0; j < numLngs; j++) {
        const lng = -180 + (360 / numLngs) * j;
        const theta = (lng + 180) * (Math.PI / 180);
        dots.push({
          x: -(radius * Math.sin(phi) * Math.cos(theta)),
          y: radius * Math.cos(phi),
          z: radius * Math.sin(phi) * Math.sin(theta)
        });
      }
    }

    let pulseAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      rotationY += 0.006;
      pulseAngle += 0.04;

      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(0.25);
      const sinX = Math.sin(0.25);

      // Draw Atmospheric Glow
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.8,
        centerX,
        centerY,
        radius * 1.35
      );
      glowGrad.addColorStop(0, "rgba(124, 58, 237, 0.12)");
      glowGrad.addColorStop(0.5, "rgba(139, 92, 246, 0.05)");
      glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Draw Outer Orbit Rings
      ctx.strokeStyle = "rgba(124, 58, 237, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 1.25, radius * 0.45, -0.2, 0, Math.PI * 2);
      ctx.stroke();

      // Project & Draw Dot Grid
      dots.forEach((dot) => {
        // Rotate Y
        const x1 = dot.x * cosY - dot.z * sinY;
        const z1 = dot.z * cosY + dot.x * sinY;
        // Rotate X (tilt)
        const y2 = dot.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + dot.y * sinX;

        // Front vs back rendering
        const alpha = Math.max(0.1, (z2 + radius) / (2 * radius));
        const px = centerX + x1;
        const py = centerY + y2;

        if (z2 > -radius * 0.2) {
          ctx.fillStyle = z2 > 0 ? `rgba(124, 58, 237, ${alpha * 0.7})` : `rgba(165, 180, 252, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(px, py, z2 > 0 ? 1.5 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Project Tech Hub Nodes
      const projectedNodes = nodes.map((node) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;
        return {
          ...node,
          px: centerX + x1,
          py: centerY + y2,
          z2,
          visible: z2 > -20
        };
      });

      // Draw Arcs / Lines between visible nodes
      ctx.lineWidth = 1.5;
      for (let i = 0; i < projectedNodes.length; i++) {
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const n1 = projectedNodes[i];
          const n2 = projectedNodes[j];

          if (n1.visible && n2.visible && (i + j) % 2 === 0) {
            const dist = Math.hypot(n1.px - n2.px, n1.py - n2.py);
            if (dist < 220) {
              const grad = ctx.createLinearGradient(n1.px, n1.py, n2.px, n2.py);
              grad.addColorStop(0, "rgba(124, 58, 237, 0.5)");
              grad.addColorStop(0.5, "rgba(236, 72, 153, 0.6)");
              grad.addColorStop(1, "rgba(99, 102, 241, 0.5)");

              ctx.strokeStyle = grad;
              ctx.beginPath();
              const midX = (n1.px + n2.px) / 2;
              const midY = (n1.py + n2.py) / 2 - 30;
              ctx.quadraticCurveTo(midX, midY, n2.px, n2.py);
              ctx.moveTo(n1.px, n1.py);
              ctx.quadraticCurveTo(midX, midY, n2.px, n2.py);
              ctx.stroke();

              // Traveling photon particle along the arc
              const t = (pulseAngle * 0.5 + i) % 1;
              const photonX = (1 - t) * (1 - t) * n1.px + 2 * (1 - t) * t * midX + t * t * n2.px;
              const photonY = (1 - t) * (1 - t) * n1.py + 2 * (1 - t) * t * midY + t * t * n2.py;
              ctx.fillStyle = "#ffffff";
              ctx.shadowColor = "#8b5cf6";
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(photonX, photonY, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
      }

      // Draw Node Pins & Labels
      projectedNodes.forEach((n) => {
        if (n.visible) {
          // Node glowing pin
          ctx.fillStyle = "#7c3aed";
          ctx.shadowColor = "#7c3aed";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(n.px, n.py, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(n.px, n.py, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Pulse ring
          const ringRadius = 4 + (Math.sin(pulseAngle + n.px) + 1) * 4;
          ctx.strokeStyle = "rgba(124, 58, 237, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.px, n.py, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          // City Label
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText(n.city, n.px + 8, n.py + 3);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const curMatch = matches[activeMatch];

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center justify-center">
      {/* Dynamic Glass Globe Canvas Container */}
      <div className="relative w-full aspect-square max-w-[440px] flex items-center justify-center">
        
        {/* Ambient Gradient Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-indigo-500/10 to-transparent rounded-full blur-3xl" />

        {/* Floating Stat Badge Left */}
        <div className="absolute top-4 left-0 sm:-left-4 z-20 glass-card-elevated px-3.5 py-2 flex items-center gap-2.5 shadow-lg border border-purple-100 bg-white/90 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Global Twins</div>
            <div className="text-xs font-black text-slate-900">1,284 Active</div>
          </div>
        </div>

        {/* Floating Stat Badge Right */}
        <div className="absolute bottom-10 right-0 sm:-right-4 z-20 glass-card-elevated px-3.5 py-2 flex items-center gap-2.5 shadow-lg border border-purple-100 bg-white/90 backdrop-blur-md">
          <span className="text-base">⚡</span>
          <div>
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Match Speed</div>
            <div className="text-xs font-black text-purple-700">&lt; 60 Seconds</div>
          </div>
        </div>

        {/* 3D Canvas Element */}
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          className="w-full h-full relative z-10 pointer-events-none drop-shadow-xl"
        />
      </div>

      {/* Floating Dynamic Match Toast Overlay */}
      <div className="w-full max-w-md mt-2 relative z-30 glass-card-elevated p-4 border border-purple-200/80 bg-white/95 backdrop-blur-md shadow-xl rounded-2xl transition-all space-y-2 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-[11px] font-black uppercase text-purple-900 tracking-wider">
              LIVE TWIN NEGOTIATION
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            {curMatch.score} Match
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 pt-0.5">
          <span>{curMatch.user1}</span>
          <span className="text-purple-600 font-black">↔</span>
          <span>{curMatch.user2}</span>
        </div>

        <p className="text-[11px] text-slate-600 bg-purple-50/70 p-2 rounded-xl font-medium leading-relaxed border border-purple-100/60">
          ✨ {curMatch.reason}
        </p>
      </div>
    </div>
  );
}
