import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <article className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <div className="text-xs uppercase tracking-widest text-ink-soft mb-3">
          Legal
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="text-sm text-ink-soft mt-2">Last updated {updated}</div>
        <div className="mt-10 space-y-5 text-ink-soft leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-2 [&_p]:leading-relaxed">
          {children}
        </div>
      </article>
      <SiteFooter />
    </>
  );
}
