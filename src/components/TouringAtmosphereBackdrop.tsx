interface TouringHeroBannerProps {
  title: string;
  subtitle: string;
}

/**
 * Full-canvas subtle topographic & winding highway backdrop at very low opacity.
 * Sits strictly behind solid Material Design 3 surface cards.
 */
export function TouringCanvasBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Subtle Light / Dark Atmospheric Gradient Wash */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            'linear-gradient(180deg, #F1F5FA 0%, #F8FAFC 55%, #FDF7F2 100%)',
        }}
      />
      <div
        className="hidden dark:block absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #0A0F16 0%, #0E1624 55%, #12141D 100%)',
        }}
      />

      {/* Low-Opacity Topographic Contour Lines & Highway Road Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.065] dark:opacity-[0.09]"
        viewBox="0 0 390 760"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((idx) => {
          const yOffset = idx * 46;
          return (
            <path
              key={`contour-${idx}`}
              d={`M -30 ${130 + yOffset} C 110 ${65 + yOffset}, 250 ${220 + yOffset}, 420 ${125 + yOffset}`}
              fill="none"
              stroke="currentColor"
              className="text-[#1E3A8A] dark:text-[#93C5FD]"
              strokeWidth="1.2"
            />
          );
        })}

        {[0, 1, 2].map((idx) => {
          const yOffset = idx * 38;
          return (
            <path
              key={`contour-low-${idx}`}
              d={`M -20 ${540 + yOffset} C 120 ${475 + yOffset}, 270 ${620 + yOffset}, 420 ${520 + yOffset}`}
              fill="none"
              stroke="currentColor"
              className="text-[#9A3412] dark:text-[#FB923C]"
              strokeWidth="1.1"
            />
          );
        })}

        {/* Subtle dashed highway centerline in bottom whitespace */}
        <path
          d="M -20 695 C 120 605, 260 735, 420 630"
          fill="none"
          stroke="currentColor"
          className="text-[#EA580C] dark:text-[#FB923C]"
          strokeWidth="2.2"
          strokeDasharray="10 9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Touring Atmosphere Hero Banner:
 * Asphalt charcoal + midnight adventure blue + subtle golden hour horizon glow
 * with low-opacity contour traces behind crisp white typography.
 */
export function TouringHeroBanner({ title, subtitle }: TouringHeroBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-[#334155]/70 px-4 py-4 shadow-sm"
      style={{
        background:
          'linear-gradient(135deg, #0B1117 0%, #172554 58%, #7C2D12 100%)',
      }}
    >
      {/* Golden Hour Horizon Glow + Topographic Contours */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full"
        viewBox="0 0 360 140"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="goldenHorizonGlow" cx="88%" cy="85%" r="55%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#EA580C" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="140" fill="url(#goldenHorizonGlow)" />

        {[1, 2, 3, 4].map((ring) => (
          <path
            key={ring}
            d={`M ${120 + ring * 18} -10 C 210 ${35 + ring * 12}, 280 ${15 + ring * 10}, 375 ${65 + ring * 12}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.1"
          />
        ))}

        {/* Winding road horizon trace */}
        <path
          d="M 195 145 C 245 92, 305 102, 365 40"
          fill="none"
          stroke="rgba(253,186,116,0.32)"
          strokeWidth="2"
          strokeDasharray="7 6"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative z-10 space-y-1">
        <h1 className="text-xl font-bold tracking-tight leading-snug text-white text-balance">
          {title}
        </h1>
        <p className="text-xs text-[#E2E8F0] leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}
