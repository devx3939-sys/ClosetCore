import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import ClosetMockup from '@/components/ClosetMockup';
import FAQ from '@/components/FAQ';

export default function Home() {
  return (
    <>
      <SiteNav />

      {/* Hero */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid md:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur border border-line text-xs mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" />
              <span>AI-powered · Free forever tier</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight">
              Your wardrobe,
              <br />
              <span className="gradient-text italic">finally</span> in one
              place.
            </h1>
            <p className="mt-6 text-lg text-ink-soft max-w-md leading-relaxed">
              Snap one wide photo of your closet — ClosetCore catalogs every
              piece automatically. Build outfits in seconds. Get colors that
              actually flatter your skin tone. Available now in any browser —
              native Mac, Windows, iOS, and Android apps coming soon.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="bg-ink text-white px-6 py-3.5 rounded-full hover:bg-black transition shadow-lg shadow-ink/20"
              >
                Start free →
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3.5 rounded-full border border-line bg-white/60 backdrop-blur hover:bg-white transition"
              >
                Open web app
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-ink-soft">
              <Stat n="30" l="items free" />
              <Stat n="Web" l="available now" />
              <Stat n="AI" l="powered" />
            </div>
          </div>

          <div className="md:pl-6">
            <ClosetMockup />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-line/60 bg-white/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              Why ClosetCore
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
              Built for how you actually get dressed
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Feature
              swatch={['#0f0f10', '#a0522d', '#e8b4b8']}
              title="One-shot closet scan"
              body="Take a single wide photo of your wardrobe. AI identifies every garment — name, brand, color, category, season — and crops a thumbnail of each one. 20+ items added in under a minute."
            />
            <Feature
              swatch={['#5a6f4d', '#1d2b3a', '#d6b5db']}
              title="Auto-fill from a single photo"
              body="Snap any item, hit auto-fill. Brand, fabric color, occasion, season — all populated. Edit only what you want to change."
            />
            <Feature
              swatch={['#FFB6A3', '#A4C2D7', '#A0522D', '#000080']}
              title="AI color analysis from a selfie"
              body="Upload a clear selfie. The app reads your skin/hair/eye undertones, picks your best season (Spring/Summer/Autumn/Winter), and customizes every season's palette to your exact complexion."
            />
            <Feature
              swatch={['#1d2b3a', '#FFD27D', '#A0522D']}
              title="Stylist-grade outfit suggestions"
              body="Hit Suggest. The AI builds 4–6 outfits from what you already own — using color theory, proportion balance, texture mixing, and your palette. Different vibes every time."
            />
            <Feature
              swatch={['#e8b4b8', '#A4C2D7', '#5a6f4d']}
              title="Find better photos online"
              body="Got a generic Nike tee in a bad lighting? One tap looks up clean product shots from real retailers (Nike, Zara, H&M, Uniqlo and 30+ more) and replaces the thumbnail with a crisp catalog photo."
            />
            <Feature
              swatch={['#000080', '#5a6f4d', '#FFD27D']}
              title="Wear tracking, search, favorites"
              body="See what you actually wear vs. what just hangs. Tap 'Wore today' on an outfit. Search by name, brand, or color. Star favorites for one-tap access. Long-press to delete."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
            How it works
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Set up in an afternoon. Use it forever.
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <Step
            n={1}
            title="Scan your closet"
            body="Take one wide photo of your hanging clothes or shelf. AI detects every garment and adds them all in one shot."
          />
          <Step
            n={2}
            title="Auto-fill the rest"
            body="Snap photos of items the scan missed. Auto-fill names, brands, colors, seasons, and occasions for each one."
          />
          <Step
            n={3}
            title="Find your colors"
            body="Upload a selfie or pick your season manually. Get a personalized palette tuned to your undertones."
          />
          <Step
            n={4}
            title="Build & wear"
            body="Drag pieces into outfits, or let the AI suggest combos based on your palette. Tap 'Wore today' to track."
          />
        </div>
      </section>

      {/* Big visual */}
      <section className="bg-ink text-cream">
        <div className="max-w-6xl mx-auto px-6 py-28 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-cream-2/60 mb-3">
              Personal color analysis
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
              The colors that
              <br />
              <span className="italic text-rose">love you back.</span>
            </h2>
            <p className="mt-6 text-cream-2/80 leading-relaxed max-w-md">
              Upload a selfie. AI reads your skin tone, hair, and eyes,
              identifies your warm or cool undertone, and assigns your color
              season. Then it customizes every season's palette to your exact
              complexion — so even your "off-season" colors are tuned to you.
            </p>
            <Link
              href="/features"
              className="inline-block mt-8 px-6 py-3 rounded-full bg-white text-ink hover:bg-cream-2 transition"
            >
              How analysis works →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SeasonCard name="Spring" colors={['#FFB6A3', '#FFD27D', '#A8E6A1', '#FFE5A8']} />
            <SeasonCard name="Summer" colors={['#A4C2D7', '#D6B5D6', '#B8D8D8', '#C6B7DB']} />
            <SeasonCard name="Autumn" colors={['#A0522D', '#8B4513', '#556B2F', '#B8860B']} />
            <SeasonCard name="Winter" colors={['#000080', '#8B0000', '#4B0082', '#2F4F4F']} />
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="border-y border-line/60 bg-white/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              Everywhere you are
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
              One account. Every device.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            <Platform name="Web" sub="Available now" available />
            <Platform name="Windows" sub="Coming soon" />
            <Platform name="macOS" sub="Coming soon" />
            <Platform name="iOS" sub="Coming soon" />
            <Platform name="Android" sub="Coming soon" />
          </div>

          <div className="text-center mt-12">
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 rounded-full bg-ink text-white hover:bg-black transition"
            >
              Open the web app →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
            Questions
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Things people ask
          </h2>
        </div>
        <FAQ />
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <div className="bg-ink text-cream rounded-2xl p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-rose/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-peach/30 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
              Your wardrobe deserves
              <br />
              <span className="italic">better than chaos.</span>
            </h2>
            <p className="mt-5 text-cream-2/80 max-w-md mx-auto">
              Free forever for 30 items, with AI auto-fill and one full color
              analysis. Upgrade to Pro for $4.99/mo when you need more — cancel
              anytime. Sign up in 10 seconds, no credit card.
            </p>
            <Link
              href="/signup"
              className="inline-block mt-8 px-8 py-4 rounded-full bg-white text-ink hover:bg-cream-2 transition"
            >
              Start your closet →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-2xl">{n}</div>
      <div className="text-xs uppercase tracking-wider">{l}</div>
    </div>
  );
}

function Feature({
  swatch,
  title,
  body,
}: {
  swatch: string[];
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-7 lift">
      <div className="flex gap-1.5 mb-5">
        {swatch.map((c) => (
          <div
            key={c}
            className="w-6 h-6 rounded-full border border-line"
            style={{ background: c }}
          />
        ))}
      </div>
      <h3 className="font-display text-2xl font-semibold mb-2">{title}</h3>
      <p className="text-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="font-display text-3xl text-rose mb-3">0{n}</div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

function SeasonCard({ name, colors }: { name: string; colors: string[] }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-xl p-4 backdrop-blur">
      <div className="font-display text-lg mb-3">{name}</div>
      <div className="flex h-7 rounded overflow-hidden">
        {colors.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

function Platform({
  name,
  sub,
  available,
}: {
  name: string;
  sub: string;
  available?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 text-center lift border ${
        available
          ? 'bg-white border-sage/60 ring-1 ring-sage/30'
          : 'bg-white/60 border-line'
      }`}
    >
      <div className="font-display text-xl mb-1">{name}</div>
      <div className={`text-xs ${available ? 'text-sage' : 'text-ink-soft'}`}>
        {sub}
      </div>
    </div>
  );
}
