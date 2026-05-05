import Link from 'next/link';
import Logo from './Logo';

export default function SiteFooter() {
  return (
    <footer className="border-t border-line/60 mt-32 bg-white/40">
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-ink mb-4">
            <Logo size={24} />
            <span className="font-display font-semibold text-lg">ClosetCore</span>
          </Link>
          <p className="text-sm text-ink-soft max-w-xs">
            Your wardrobe, organized. Outfits in seconds. The colors that
            flatter you.
          </p>
        </div>
        <Col title="Product">
          <FooterLink href="/features">Features</FooterLink>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/download">Download</FooterLink>
        </Col>
        <Col title="Company">
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
        </Col>
        <Col title="Account">
          <FooterLink href="/login">Sign in</FooterLink>
          <FooterLink href="/signup">Create account</FooterLink>
        </Col>
      </div>
      <div className="border-t border-line/60 py-6 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} ClosetCore. Made with care for what hangs in
        your wardrobe.
      </div>
    </footer>
  );
}

function Col({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-soft mb-3">
        {title}
      </div>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="hover:text-ink-soft transition">
        {children}
      </Link>
    </li>
  );
}
