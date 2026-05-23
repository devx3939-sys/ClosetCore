'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shirt,
  Layers,
  Palette,
  User,
  CreditCard,
  Menu,
  X,
  type LucideProps,
} from 'lucide-react';
import Logo from './Logo';
import SignOutButton from './SignOutButton';

const NAV: {
  href: string;
  label: string;
  Icon: ComponentType<LucideProps>;
}[] = [
  { href: '/dashboard/closet', label: 'My Closet', Icon: Shirt },
  { href: '/dashboard/outfits', label: 'Outfits', Icon: Layers },
  { href: '/dashboard/palette', label: 'Color Palette', Icon: Palette },
  { href: '/dashboard/profile', label: 'Profile', Icon: User },
  { href: '/dashboard/subscription', label: 'Subscription', Icon: CreditCard },
];

export default function DashboardShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-white sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Logo size={24} />
          <span className="font-display font-semibold">ClosetCore</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg border border-line"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col bg-white border-r border-line p-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-ink px-2 py-3 mb-2"
        >
          <Logo size={26} />
          <span className="font-display font-semibold text-lg">ClosetCore</span>
        </Link>
        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 transition ${
                  active ? 'bg-ink text-white' : 'text-ink hover:bg-cream-2'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line pt-3">
          <div className="text-xs text-ink-soft px-3 mb-1.5 truncate">
            {email}
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile sheet */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-white p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="self-end p-2 text-ink-soft"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <nav className="flex flex-col gap-0.5 flex-1 mt-2">
              {NAV.map(({ href, label, Icon }) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 ${
                      active ? 'bg-ink text-white' : 'hover:bg-cream-2'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line pt-3">
              <div className="text-xs text-ink-soft px-3 mb-1.5 truncate">
                {email}
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}

      <main className="px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full">
        {children}
      </main>
    </div>
  );
}
