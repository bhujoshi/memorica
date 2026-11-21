import React from "react";

/**
 * Lightweight, mood-compatible Indian marigold & mango-leaf garland divider.
 * Pure decorative SVG (aria-hidden) for subtle celebratory warmth.
 */
export function FestiveToranDivider({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-3 select-none ${className}`}
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/70 to-emerald-300/70" />
      <svg
        width="108"
        height="22"
        viewBox="0 0 108 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M4 6C22 14 38 14 54 6C70 14 86 14 104 6"
          stroke="#d97706"
          strokeWidth="1.2"
          strokeOpacity="0.55"
          strokeLinecap="round"
        />
        {/* Mango leaves */}
        <path
          d="M21 11C19 15 21 19 24 20C26 17 26 13 21 11Z"
          fill="#047857"
          fillOpacity="0.7"
        />
        <path
          d="M37 11C35 15 37 19 40 20C42 17 42 13 37 11Z"
          fill="#059669"
          fillOpacity="0.7"
        />
        <path
          d="M71 11C73 15 71 19 68 20C66 17 66 13 71 11Z"
          fill="#059669"
          fillOpacity="0.7"
        />
        <path
          d="M87 11C89 15 87 19 84 20C82 17 82 13 87 11Z"
          fill="#047857"
          fillOpacity="0.7"
        />
        {/* Marigold blossoms */}
        <circle cx="14" cy="9" r="3.2" fill="#f59e0b" />
        <circle cx="14" cy="9" r="1.4" fill="#fef3c7" />
        <circle cx="54" cy="7" r="4.5" fill="#d97706" />
        <circle cx="54" cy="7" r="2.2" fill="#fde68a" />
        <circle cx="94" cy="9" r="3.2" fill="#f59e0b" />
        <circle cx="94" cy="9" r="1.4" fill="#fef3c7" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/70 to-emerald-300/70" />
    </div>
  );
}

/**
 * Delicate symmetrical lotus & diya crest for invitation headers and celebration cards.
 */
export function FestiveLotusCrest({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  const petalStroke = light ? "#fde68a" : "#b45309";
  const petalFill = light ? "#fbbf24" : "#f59e0b";
  const leafFill = light ? "#a7f3d0" : "#047857";
  return (
    <svg
      aria-hidden="true"
      width="84"
      height="24"
      viewBox="0 0 84 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto shrink-0 ${className}`}
    >
      <path
        d="M4 13H26M58 13H80"
        stroke={petalStroke}
        strokeWidth="1.1"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />
      <circle cx="28" cy="13" r="1.6" fill={petalFill} fillOpacity="0.85" />
      <circle cx="56" cy="13" r="1.6" fill={petalFill} fillOpacity="0.85" />
      {/* Center lotus */}
      <path
        d="M42 4C44.8 7.5 45.2 12 42 16C38.8 12 39.2 7.5 42 4Z"
        fill={petalFill}
        fillOpacity="0.9"
      />
      <path
        d="M42 16C38 14.5 34.5 11.5 34 7.5C37.5 8.2 40.5 11.5 42 16Z"
        fill={leafFill}
        fillOpacity="0.75"
      />
      <path
        d="M42 16C46 14.5 49.5 11.5 50 7.5C46.5 8.2 43.5 11.5 42 16Z"
        fill={leafFill}
        fillOpacity="0.75"
      />
      <path
        d="M36 18.5C38.5 17.5 45.5 17.5 48 18.5"
        stroke={petalStroke}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
