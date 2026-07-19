const PARTICLES = [
  { left: "8%", size: 3, duration: 14, delay: 0 },
  { left: "18%", size: 2, duration: 18, delay: 3 },
  { left: "32%", size: 2.5, duration: 16, delay: 6 },
  { left: "47%", size: 2, duration: 20, delay: 1 },
  { left: "61%", size: 3, duration: 15, delay: 8 },
  { left: "74%", size: 2, duration: 19, delay: 4 },
  { left: "85%", size: 2.5, duration: 17, delay: 10 },
  { left: "93%", size: 2, duration: 21, delay: 2 },
];

/** Deterministic positions/timings (not Math.random) so server and client markup match exactly. */
export default function FloatingParticles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-particle absolute rounded-full bg-primary"
          style={{
            left: p.left,
            bottom: 0,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            boxShadow: "0 0 6px rgba(182,255,34,0.8)",
          }}
        />
      ))}
    </div>
  );
}
