'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-12 text-ink"
          >
            <Logo size={26} />
            <span className="font-display font-semibold text-lg">ClosetCore</span>
          </Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight mb-2">
            Welcome back.
          </h1>
          <p className="text-ink-soft mb-8">
            Sign in to pick up where you left off.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-xs text-ink-soft">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-line rounded-lg px-3 py-2.5"
            />
            <label className="text-xs text-ink-soft mt-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-line rounded-lg px-3 py-2.5"
            />
            {err && <div className="text-sm text-red-600">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="bg-ink text-white py-3 rounded-full mt-3 disabled:opacity-50 hover:bg-black transition"
            >
              {busy ? '…' : 'Sign in'}
            </button>
          </form>
          <div className="text-sm text-ink-soft mt-6 text-center">
            New to ClosetCore?{' '}
            <Link href="/signup" className="text-ink underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden md:block bg-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose/20 via-transparent to-peach/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cream text-center max-w-sm px-6">
          <div className="font-display text-4xl font-semibold leading-tight mb-4">
            Your whole wardrobe, in one place.
          </div>
          <div className="text-cream-2/60 text-sm">Catalog every piece. Build outfits in seconds. Find your colors.</div>
        </div>
        <div className="absolute bottom-10 left-10 right-10 grid grid-cols-6 gap-2">
          {['#FFB6A3', '#A4C2D7', '#A0522D', '#000080', '#FFD27D', '#5a6f4d'].map(
            (c) => (
              <div
                key={c}
                className="aspect-square rounded-md"
                style={{ background: c }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
