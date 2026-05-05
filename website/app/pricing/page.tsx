import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <>
      <SiteNav />

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          Pricing
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight">
          Simple, fair pricing
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-xl mx-auto">
          Start free. Upgrade only when your closet outgrows it. Cancel anytime.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-5">
          <Tier
            name="Free"
            price="$0"
            tagline="Forever, no card."
            features={[
              '30 closet items',
              '10 AI auto-fills / month',
              '1 closet scan / month',
              '5 AI outfit suggestions / month',
              '1 AI palette analysis (lifetime)',
              'Web + mobile + desktop',
            ]}
            cta="Get started"
            ctaHref="/signup"
          />
          <Tier
            name="Pro"
            price="$4.99"
            tagline="per month"
            highlight
            features={[
              'Unlimited closet items',
              '200 AI auto-fills / month',
              '20 closet scans / month',
              '100 AI outfit suggestions / month',
              '10 palette re-analyses / month',
              'Unlimited online photo lookup',
              'Priority support',
            ]}
            cta="Start Pro"
            ctaHref="/signup"
          />
          <Tier
            name="Lifetime"
            price="$99"
            tagline="one-time"
            features={[
              'Everything in Pro, forever',
              'No subscription, ever',
              'Pay once, use on all devices',
              'Priority feature requests',
            ]}
            cta="Buy lifetime"
            ctaHref="/signup"
          />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold mb-4">
          Compare in detail
        </h2>
        <div className="bg-white border border-line rounded-2xl overflow-hidden mt-8">
          <Row label="Closet items" free="30" prem="Unlimited" life="Unlimited" head />
          <Row label="AI auto-fill from photo" free="10 / mo" prem="200 / mo" life="200 / mo" />
          <Row label="Scan whole closet" free="1 / mo" prem="20 / mo" life="20 / mo" />
          <Row label="AI outfit photo" free="5 / mo" prem="100 / mo" life="100 / mo" />
          <Row label="AI outfit suggestions" free="5 / mo" prem="100 / mo" life="100 / mo" />
          <Row label="AI palette analysis" free="1 lifetime" prem="10 / mo" life="10 / mo" />
          <Row label="Find online photo" free="5 / mo" prem="Unlimited" life="Unlimited" />
          <Row label="Priority support" free="—" prem="✓" life="✓" />
          <Row label="Subscription" free="—" prem="$4.99/mo" life="One-time" />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Tier({
  name,
  price,
  tagline,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-7 ${
        highlight
          ? 'bg-ink text-cream shadow-2xl shadow-ink/20 scale-[1.02] relative overflow-hidden'
          : 'bg-white border border-line'
      }`}
    >
      {highlight && (
        <>
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-rose/30 blur-3xl" />
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-rose/30 text-xs">
            Most popular
          </div>
        </>
      )}
      <div className="relative">
        <div className={`text-sm ${highlight ? 'text-cream-2/70' : 'text-ink-soft'}`}>
          {name}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="font-display text-5xl font-semibold">{price}</div>
          <div className={`text-sm ${highlight ? 'text-cream-2/70' : 'text-ink-soft'}`}>
            {tagline}
          </div>
        </div>
        <ul className="mt-6 space-y-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className={highlight ? 'text-rose' : 'text-sage'}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={`mt-7 block text-center px-4 py-3 rounded-full transition ${
            highlight
              ? 'bg-white text-ink hover:bg-cream-2'
              : 'bg-ink text-white hover:bg-black'
          }`}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  free,
  prem,
  life,
  head,
}: {
  label: string;
  free: string;
  prem: string;
  life: string;
  head?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-4 px-5 py-3 text-sm ${
        head ? 'bg-cream-2/40 font-medium' : 'border-t border-line/60'
      }`}
    >
      <div className="text-left">{label}</div>
      <div className="text-center text-ink-soft">{free}</div>
      <div className="text-center font-medium">{prem}</div>
      <div className="text-center text-ink-soft">{life}</div>
    </div>
  );
}
