"use client";

import { motion } from "framer-motion";

/**
 * Realistic dark world map with a glowing network overlay.
 *
 * Background: dark navy radial gradient.
 * Landmasses: realistic continent outlines sourced from /world-map.svg
 *   (equirectangular projection, viewBox 0 0 1000 500).
 * Overlay: cyan node halos, animated connection arcs, traveling packets.
 *
 * Coordinates use the same equirectangular projection so the overlay
 * lines up exactly with the underlying map:
 *   x = (lon + 180) / 360 * 1000
 *   y = (90 - lat) / 180 * 500
 */

const NODES = [
  { x: 158, y: 114, label: "Vancouver" },
  { x: 161, y: 144, label: "San Francisco" },
  { x: 172, y: 156, label: "Los Angeles" },
  { x: 225, y: 196, label: "Mexico City" },
  { x: 258, y: 133, label: "Chicago" },
  { x: 281, y: 131, label: "Toronto" },
  { x: 294, y: 137, label: "New York" },
  { x: 278, y: 178, label: "Miami" },
  { x: 294, y: 237, label: "Bogota" },
  { x: 286, y: 283, label: "Lima" },
  { x: 371, y: 314, label: "Sao Paulo" },
  { x: 338, y: 346, label: "Buenos Aires" },
  { x: 500, y: 107, label: "London" },
  { x: 506, y: 114, label: "Paris" },
  { x: 524, y: 111, label: "Frankfurt" },
  { x: 526, y: 124, label: "Milan" },
  { x: 550, y: 85,  label: "Stockholm" },
  { x: 604, y: 95,  label: "Moscow" },
  { x: 581, y: 136, label: "Istanbul" },
  { x: 479, y: 157, label: "Casablanca" },
  { x: 586, y: 167, label: "Cairo" },
  { x: 509, y: 232, label: "Lagos" },
  { x: 602, y: 254, label: "Nairobi" },
  { x: 578, y: 322, label: "Johannesburg" },
  { x: 654, y: 180, label: "Dubai" },
  { x: 702, y: 202, label: "Mumbai" },
  { x: 715, y: 170, label: "Delhi" },
  { x: 788, y: 246, label: "Singapore" },
  { x: 817, y: 188, label: "Hong Kong" },
  { x: 838, y: 163, label: "Shanghai" },
  { x: 853, y: 145, label: "Seoul" },
  { x: 888, y: 151, label: "Tokyo" },
  { x: 919, y: 344, label: "Sydney" },
  { x: 985, y: 352, label: "Auckland" },
];

const CONNECTIONS = [
  { a: 6,  b: 12, dur: 5.0 },
  { a: 6,  b: 14, dur: 5.2 },
  { a: 4,  b: 12, dur: 4.8 },
  { a: 10, b: 12, dur: 5.5 },
  { a: 1,  b: 6,  dur: 3.8 },
  { a: 6,  b: 4,  dur: 2.4 },
  { a: 6,  b: 7,  dur: 2.8 },
  { a: 7,  b: 3,  dur: 2.6 },
  { a: 0,  b: 1,  dur: 2.4 },
  { a: 2,  b: 3,  dur: 2.8 },
  { a: 3,  b: 8,  dur: 3.0 },
  { a: 8,  b: 9,  dur: 2.4 },
  { a: 8,  b: 10, dur: 3.4 },
  { a: 10, b: 11, dur: 2.6 },
  { a: 12, b: 14, dur: 2.2 },
  { a: 12, b: 13, dur: 1.8 },
  { a: 14, b: 15, dur: 2.0 },
  { a: 14, b: 17, dur: 3.0 },
  { a: 16, b: 17, dur: 2.8 },
  { a: 12, b: 16, dur: 2.4 },
  { a: 13, b: 19, dur: 2.6 },
  { a: 18, b: 20, dur: 2.4 },
  { a: 17, b: 18, dur: 2.6 },
  { a: 20, b: 22, dur: 3.5 },
  { a: 21, b: 22, dur: 3.0 },
  { a: 22, b: 23, dur: 2.8 },
  { a: 20, b: 24, dur: 3.0 },
  { a: 24, b: 25, dur: 2.4 },
  { a: 14, b: 24, dur: 4.0 },
  { a: 25, b: 26, dur: 2.0 },
  { a: 25, b: 27, dur: 3.4 },
  { a: 24, b: 27, dur: 3.8 },
  { a: 27, b: 28, dur: 2.4 },
  { a: 28, b: 29, dur: 2.0 },
  { a: 29, b: 30, dur: 1.8 },
  { a: 29, b: 31, dur: 2.4 },
  { a: 30, b: 31, dur: 1.6 },
  { a: 2,  b: 31, dur: 6.0 },
  { a: 1,  b: 29, dur: 5.8 },
  { a: 0,  b: 31, dur: 5.6 },
  { a: 27, b: 32, dur: 4.0 },
  { a: 31, b: 32, dur: 4.5 },
  { a: 32, b: 33, dur: 2.0 },
];

function arc(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(dist * 0.22, 85);
  const my = (a.y + b.y) / 2 - sag;
  return `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
}

export function WorldMap() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep navy base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, #15233d 0%, #0b1525 55%, #060c18 100%)",
        }}
      />

      {/* Subtle blue glow at the equator */}
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(56,130,246,0.18) 0%, rgba(6,12,24,0) 60%)",
        }}
      />

      {/* Realistic world map silhouette */}
      <img
        src="/world-map.svg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        style={{ filter: "brightness(1.55) saturate(0.4)", opacity: 0.95 }}
        draggable={false}
      />

      {/* Animated network overlay - shares the same 1000x500 projection */}
      <svg
        viewBox="0 0 1000 500"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter id="wm-glow-line" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wm-glow-pkt" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wm-glow-node" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="wm-node-rg">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wm-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.2" />
          </linearGradient>
          {CONNECTIONS.map(({ a, b }, i) => (
            <path key={i} id={`wm-p${i}`} d={arc(NODES[a], NODES[b])} />
          ))}
        </defs>

        {/* Connection lines */}
        {CONNECTIONS.map(({ a, b }, i) => (
          <motion.path
            key={`l-${i}`}
            d={arc(NODES[a], NODES[b])}
            fill="none"
            stroke="url(#wm-line-grad)"
            strokeWidth="0.9"
            strokeOpacity="0.85"
            filter="url(#wm-glow-line)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, delay: 0.3 + i * 0.08, ease: "easeOut" }}
          />
        ))}

        {/* Traveling data packets */}
        {CONNECTIONS.map(({ dur }, i) => (
          <circle key={`p-${i}`} r="2.2" fill="#a5f3fc" filter="url(#wm-glow-pkt)">
            <animateMotion
              dur={`${dur}s`}
              repeatCount="indefinite"
              begin={`${-(i * 0.45)}s`}
            >
              <mpath href={`#wm-p${i}`} />
            </animateMotion>
          </circle>
        ))}

        {/* Node halos */}
        {NODES.map((n, i) => (
          <circle key={`ho-${i}`} cx={n.x} cy={n.y} r="18" fill="url(#wm-node-rg)">
            <animate
              attributeName="r"
              values="12;26;12"
              dur="3.5s"
              repeatCount="indefinite"
              begin={`${i * 0.18}s`}
            />
            <animate
              attributeName="opacity"
              values="0.95;0.25;0.95"
              dur="3.5s"
              repeatCount="indefinite"
              begin={`${i * 0.18}s`}
            />
          </circle>
        ))}

        {/* Node ring pulse */}
        {NODES.map((n, i) => (
          <circle
            key={`hr-${i}`}
            cx={n.x}
            cy={n.y}
            r="6"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="0.7"
          >
            <animate
              attributeName="r"
              values="5;20;5"
              dur="3.5s"
              repeatCount="indefinite"
              begin={`${i * 0.18 + 0.7}s`}
            />
            <animate
              attributeName="opacity"
              values="0.6;0;0.6"
              dur="3.5s"
              repeatCount="indefinite"
              begin={`${i * 0.18 + 0.7}s`}
            />
          </circle>
        ))}

        {/* Node cores */}
        {NODES.map((n, i) => (
          <g key={`nc-${i}`} filter="url(#wm-glow-node)">
            <circle cx={n.x} cy={n.y} r="2.6" fill="#67e8f9" />
            <circle cx={n.x} cy={n.y} r="1.2" fill="#ffffff" />
          </g>
        ))}
      </svg>
    </div>
  );
}
