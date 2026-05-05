import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <section className="max-w-2xl mx-auto px-6 py-32 text-center">
        <div className="font-display text-8xl font-semibold gradient-text mb-4">
          404
        </div>
        <h1 className="font-display text-3xl font-semibold mb-3">
          That hanger is empty.
        </h1>
        <p className="text-ink-soft mb-8">
          The page you're looking for isn't in this closet. Let's get you back
          to one that has clothes in it.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 rounded-full bg-ink text-white hover:bg-black transition"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-full border border-line bg-white hover:bg-cream-2 transition"
          >
            My closet
          </Link>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
