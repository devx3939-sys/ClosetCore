import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <>
      <SiteNav />

      <article className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          About
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
          A closet that actually
          <br />
          <span className="italic gradient-text">remembers itself.</span>
        </h1>

        <div className="prose prose-lg mt-12 space-y-6 text-ink-soft leading-relaxed">
          <p>
            Most of us own more clothing than ever — and wear less of it than
            ever. Stuff at the back of the closet stays at the back. We rebuy
            things we already own. We stand in front of a full wardrobe with
            nothing to wear.
          </p>
          <p>
            ClosetCore started with a simple frustration: there's no good place to
            keep track of what you own. Photo albums are a mess. Spreadsheets
            don't have pictures. Existing apps are locked to one phone, or
            riddled with ads, or paywall the basics.
          </p>
          <p>
            So we built ClosetCore the way we wanted it: native apps on every
            device, a generous free tier, beautiful by default, and zero
            attention economy gimmicks.
          </p>
          <p>
            Your wardrobe is yours. ClosetCore just helps you see it clearly.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-4">
          <Stat label="Built in" value="Open" />
          <Stat label="Native on" value="5 platforms" />
          <Stat label="Your data" value="Yours" />
        </div>

        <div className="mt-16 border-t border-line/60 pt-10">
          <h2 className="font-display text-2xl font-semibold mb-4">
            Our principles
          </h2>
          <ul className="space-y-4 text-ink-soft">
            <Principle
              title="Native &gt; web wrapper."
              body="Where users expect a real app, we build a real app — installable, fast, and integrated with the OS."
            />
            <Principle
              title="Privacy by default."
              body="Your closet is row-level secured in our database. We don't sell data, we don't run ads, and you can export everything as JSON anytime."
            />
            <Principle
              title="Generous free tier."
              body="The basics should be free. Premium unlocks scale and AI features — not the things you need to use the product."
            />
            <Principle
              title="Quiet design."
              body="The clothes are the content. ClosetCore is a frame; your wardrobe is the picture."
            />
          </ul>
        </div>
      </article>

      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-6">
      <div className="text-xs uppercase tracking-widest text-ink-soft mb-1">
        {label}
      </div>
      <div className="font-display text-2xl">{value}</div>
    </div>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <li>
      <span className="font-medium text-ink">{title}</span>{' '}
      <span>{body}</span>
    </li>
  );
}
