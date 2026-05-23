import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata = { title: 'Features' };

const groups = [
  {
    label: 'AI cataloging',
    features: [
      {
        title: 'Scan whole closet',
        body: 'One wide photo of your hanging clothes or shelf. AI detects every garment, crops a thumbnail of each, and adds them all in seconds.',
      },
      {
        title: 'Auto-fill from photo',
        body: 'Snap an item, hit auto-fill. Name, brand, primary color, color family, category, season, and occasion populate automatically.',
      },
      {
        title: 'Find online photo',
        body: 'Got a generic Nike tee with a bad photo? One tap searches retailer catalogs (Nike, Zara, H&M, Uniqlo, 30+ more) and replaces the thumbnail with a clean product shot.',
      },
    ],
  },
  {
    label: 'Closet management',
    features: [
      {
        title: 'Rich tagging',
        body: 'Brand, size, color, season, occasion, favorites — all editable, all searchable.',
      },
      {
        title: 'Smart search & filter',
        body: 'Find any piece by name, brand, or color. Filter by category. Favorites-only mode for the pieces you reach for.',
      },
      {
        title: 'Wear tracking',
        body: 'Wear count on every item. Outfit-level "Wore today" updates the underlying pieces too.',
      },
    ],
  },
  {
    label: 'Outfit building',
    features: [
      {
        title: 'Manual builder',
        body: 'Pick items from your closet, name the outfit, save. Star favorites, mark "Wore today" to track usage.',
      },
      {
        title: 'AI outfit suggestions',
        body: 'Hit Suggest. AI proposes 4–6 outfits using color theory, your palette, proportion balance (loose+fitted), texture mixing, and the statement-piece-max-1 rule. Different vibes every press.',
      },
      {
        title: 'Outfit photo capture',
        body: 'Photograph an outfit you like (worn or laid flat). AI identifies every piece, adds them to your closet, and saves the outfit.',
      },
    ],
  },
  {
    label: 'Color analysis',
    features: [
      {
        title: 'AI selfie palette',
        body: 'Upload a clear selfie. AI reads skin/hair/eye undertones, picks your best season, and customizes every season\'s palette to your specific complexion.',
      },
      {
        title: 'Manual season picker',
        body: 'Spring, Summer, Autumn, Winter — pick yours if you already know it. Get primary, secondary, accent, neutral, and avoid color groups.',
      },
      {
        title: 'Per-season detail',
        body: 'After AI analysis, click any season card to see what THAT season\'s palette looks like, tuned to your exact tones.',
      },
    ],
  },
  {
    label: 'Cross-device',
    features: [
      {
        title: 'Native everywhere',
        body: 'Real installable apps for Windows and macOS (Tauri). Native iOS and Android (Expo). Plus a full web app. One account, every device.',
      },
      {
        title: 'Instant sync',
        body: 'Add an item on your phone in the morning. The outfit\'s ready on your laptop ten seconds later. Same Supabase backend everywhere.',
      },
      {
        title: 'Real plan limits',
        body: '30 items free with one full color analysis. Pro ($4.99/mo) unlocks unlimited items and 200 AI calls/feature/month. Cancel anytime.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <SiteNav />
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          Features
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight">
          Everything ClosetCore does
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-xl mx-auto">
          Everything shipping today on every platform. Calendar planning,
          weather integration, and AR try-on are on the roadmap.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">
        {groups.map((g) => (
          <section key={g.label}>
            <div className="text-xs uppercase tracking-widest text-rose mb-4">
              {g.label}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {g.features.map((f) => (
                <div
                  key={f.title}
                  className="bg-white border border-line rounded-2xl p-6 lift"
                >
                  <h3 className="font-display text-xl font-semibold mb-2">
                    {f.title}
                  </h3>
                  <p className="text-ink-soft text-sm leading-relaxed">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <Link
          href="/signup"
          className="inline-block px-8 py-3.5 rounded-full bg-ink text-white hover:bg-black transition"
        >
          Start your closet, free →
        </Link>
      </section>

      <SiteFooter />
    </>
  );
}
