const BARS = [
  { x: 40, h: 60, delay: 0 },
  { x: 90, h: 100, delay: 0.4 },
  { x: 140, h: 45, delay: 0.8 },
  { x: 190, h: 130, delay: 1.2 },
  { x: 240, h: 75, delay: 1.6 },
  { x: 290, h: 110, delay: 2.0 },
  { x: 340, h: 55, delay: 2.4 },
  { x: 390, h: 95, delay: 2.8 },
  { x: 440, h: 65, delay: 3.2 },
  { x: 490, h: 120, delay: 3.6 },
];

/** Extremely subtle, slow-breathing candlestick silhouette in the page background. */
export default function CandlestickSilhouette() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 540 160"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-[0.05]"
    >
      {BARS.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={160 - bar.h}
          width="18"
          height={bar.h}
          fill="#b6ff22"
          className="animate-breathe"
          style={{ animationDelay: `${bar.delay}s` }}
        />
      ))}
    </svg>
  );
}
