// A pure-CSS mock of the app's closet grid, used as the hero visual.
const GRID = [
  { color: '#0f0f10', label: 'Black turtleneck', meta: 'tops · Uniqlo' },
  { color: '#a0522d', label: 'Camel coat', meta: 'outerwear · COS' },
  { color: '#5a6f4d', label: 'Olive trousers', meta: 'bottoms · Everlane' },
  { color: '#e8b4b8', label: 'Rose blouse', meta: 'tops · Madewell' },
  { color: '#d6b5db', label: 'Lilac scarf', meta: 'accessories' },
  { color: '#1d2b3a', label: 'Navy denim', meta: 'bottoms · Levi’s' },
];

export default function ClosetMockup() {
  return (
    <div className="relative w-full">
      <div className="absolute -inset-6 bg-gradient-to-br from-rose/40 via-peach/30 to-sky/30 blur-3xl rounded-full opacity-60 -z-10" />
      <div className="bg-white border border-line/80 rounded-2xl shadow-2xl shadow-ink/10 overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line/60 bg-cream-2/50">
          <span className="w-2.5 h-2.5 rounded-full bg-rose/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-peach" />
          <span className="w-2.5 h-2.5 rounded-full bg-sage" />
          <span className="ml-3 text-xs text-ink-soft">My Closet · 247 items</span>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-xl">My Closet</div>
            <div className="px-3 py-1 rounded-full bg-ink text-white text-xs">
              + Add item
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {GRID.map((g, i) => (
              <div
                key={i}
                className="bg-white border border-line/60 rounded-xl overflow-hidden"
              >
                <div
                  className="aspect-square"
                  style={{ background: g.color }}
                />
                <div className="p-2.5">
                  <div className="text-[11px] font-medium truncate">
                    {g.label}
                  </div>
                  <div className="text-[10px] text-ink-soft truncate">
                    {g.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:block absolute -left-10 -bottom-8 polaroid w-44 rotate-[-8deg] animate-float">
        <div
          className="aspect-square rounded-sm"
          style={{
            background:
              'linear-gradient(135deg, #a0522d, #b48868)',
          }}
        />
        <div className="text-[11px] text-ink-soft text-center mt-1.5 font-display italic">
          Friday casual
        </div>
      </div>

      <div className="hidden md:block absolute -right-8 -top-6 bg-white border border-line/80 rounded-xl shadow-lg p-3 w-48 rotate-[5deg]">
        <div className="text-[10px] text-ink-soft mb-1.5 uppercase tracking-wider">
          Your palette
        </div>
        <div className="text-sm font-display mb-2">Autumn</div>
        <div className="flex h-5 rounded overflow-hidden">
          {['#A0522D', '#8B4513', '#556B2F', '#B8860B', '#CD853F'].map((c) => (
            <div key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
