/**
 * Linear / modern ambient canvas: stacked gradients, grid, and slow-floating
 * indigo “light pools”. `prefers-reduced-motion` reduces animation to a static state.
 */
export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Layer 1 — base radial depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 55% at 50% -12%, #0a0a0f 0%, #050506 45%, #020203 100%)',
        }}
      />
      {/* Layer 2 — primary accent blob (top) */}
      <div
        className="av-blob av-blob-primary absolute left-1/2 top-[-20%] h-[min(100vh,900px)] w-[min(1400px,120vw)] -translate-x-1/2 rounded-full motion-safe:av-float-slow"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(94,106,210,0.22) 0%, transparent 68%)',
          filter: 'blur(120px)',
        }}
      />
      {/* Layer 3 — left warm/purple smear */}
      <div
        className="av-blob absolute -left-1/4 top-1/4 h-[min(60vh,800px)] w-[min(90vw,600px)] motion-safe:av-float-slower rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      {/* Layer 4 — right indigo/blue smear */}
      <div
        className="av-blob absolute -right-1/4 bottom-0 h-[min(50vh,700px)] w-[min(80vw,500px)] motion-safe:av-float-slow rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />
      {/* Noise: ultra-fine (CSS-only grain) */}
      <div
        className="absolute inset-0 opacity-[0.018] mix-blend-overlay"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />
    </div>
  )
}
