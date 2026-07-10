import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata = { title: 'Download' };

export default function DownloadPage() {
  return (
    <>
      <SiteNav />

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          Download
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight">
          ClosetCore, in your browser
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-xl mx-auto">
          The web app is live today — open it on any browser, no install needed.
          Native Mac, Windows, iOS, and Android apps are on the way.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-5">
        <Card
          eyebrow="Web · Available now"
          title="Any browser"
          body="No install. Open ClosetCore on Chrome, Safari, Firefox, or Edge — same account, same closet."
          actions={[{ label: 'Open web app →', href: '/dashboard' }]}
          accent="bg-gradient-to-br from-peach/20 to-sky/20"
        />
        <Card
          eyebrow="Desktop · Coming soon"
          title="Mac &amp; Windows"
          body="Real native installer. Fast, offline-friendly, integrated with your OS. In the works — use the web app in the meantime."
          actions={[{ label: 'Get notified →', href: '/signup' }]}
          comingSoon
          accent="bg-gradient-to-br from-rose/20 to-peach/20"
        />
        <Card
          eyebrow="Mobile · Coming soon"
          title="iOS &amp; Android"
          body="Take photos of new pieces the moment you buy them. Launching soon on the App Store and Play Store."
          actions={[{ label: 'Get notified →', href: '/signup' }]}
          comingSoon
          accent="bg-gradient-to-br from-sky/20 to-sage/20"
        />
        <Card
          eyebrow="Coming soon"
          title="Apple Watch &amp; iPad widgets"
          body="A glance at today's outfit on your wrist. Tomorrow's plan on your home screen."
          actions={[{ label: 'Get notified →', href: '/signup' }]}
          comingSoon
          accent="bg-gradient-to-br from-sage/20 to-rose/20"
        />
      </section>

      <section className="bg-white/50 border-y border-line/60 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-semibold mb-3">
            One account. Always in sync.
          </h2>
          <p className="text-ink-soft mb-6">
            Add an item from your phone. Edit the photo on your laptop. Pull up
            tomorrow's outfit on your iPad. Everything just works.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3.5 rounded-full bg-ink text-white hover:bg-black transition"
          >
            Create your free account →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Card({
  eyebrow,
  title,
  body,
  actions,
  accent,
  comingSoon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions: { label: string; href: string }[];
  accent: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="relative bg-white border border-line rounded-2xl p-7 lift overflow-hidden">
      <div className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl ${accent}`} />
      {comingSoon && (
        <div className="absolute top-5 right-5 z-10 px-2.5 py-1 rounded-full bg-ink/5 border border-line text-[11px] uppercase tracking-wider text-ink-soft">
          Soon
        </div>
      )}
      <div className="relative">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          {eyebrow}
        </div>
        <h2
          className="font-display text-3xl font-semibold mb-3"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <p className="text-ink-soft mb-6">{body}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="px-4 py-2 rounded-full border border-line bg-white hover:bg-cream-2 transition text-sm"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
