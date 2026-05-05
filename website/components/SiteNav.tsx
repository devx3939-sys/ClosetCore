import Link from 'next/link';
import Logo from './Logo';

export default function SiteNav() {
  return (
    <header className="border-b border-line/60 bg-cream/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Logo size={28} />
          <span className="font-display font-semibold text-lg tracking-tight">
            ClosetCore
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/features" className="hover:text-ink-soft transition">
            Features
          </Link>
          <Link href="/download" className="hover:text-ink-soft transition">
            Download
          </Link>
          <Link href="/pricing" className="hover:text-ink-soft transition">
            Pricing
          </Link>
          <Link href="/about" className="hover:text-ink-soft transition">
            About
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-block text-sm hover:text-ink-soft"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-ink text-white px-4 py-2 rounded-full text-sm hover:bg-black transition"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
