import { cn } from "@/lib/utils";

export function EditorPulseLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="editorpulse-mark-bg" x1="12" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="0.52" stopColor="#0F172A" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
        <linearGradient id="editorpulse-pulse" x1="18" y1="42" x2="52" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#editorpulse-mark-bg)" />
      <path d="M19 13h24l8 8v31H19V13Z" fill="#F8FAFC" />
      <path d="M43 13v8h8" fill="#CBD5E1" />
      <path d="M24 26h13" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M24 32h20" stroke="#CBD5E1" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24 38h10" stroke="#CBD5E1" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M17 43c4 0 4-7 8-7s4 10 8 10 4-18 8-18 4 15 8 15"
        stroke="url(#editorpulse-pulse)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="43" r="2.4" fill="#E0F2FE" />
      <path d="M14 18c0-2.8 2.2-5 5-5h5v39H14V18Z" fill="#1D4ED8" />
      <path d="M14 24h10" stroke="#93C5FD" strokeWidth="2.6" />
    </svg>
  );
}
