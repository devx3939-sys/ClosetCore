'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Logo from '@/components/Logo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
    else
      setInfo(
        'Check your email to confirm. Once confirmed, sign in from any device.'
      );
    setBusy(false);
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
            Create your closet.
          </h1>
          <p className="text-ink-soft mb-8">
            Free forever for up to 50 items. No card required.
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
            <label className="text-xs text-ink-soft mt-1">Password (min 6)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-line rounded-lg px-3 py-2.5"
            />
            {err && <div className="text-sm text-red-600">{err}</div>}
            {info && <div className="text-sm text-green-700">{info}</div>}
            <button
              type="submit"
              disabled={busy}
              className="bg-ink text-white py-3 rounded-full mt-3 disabled:opacity-50 hover:bg-black transition"
            >
              {busy ? '…' : 'Create account'}
            </button>
          </form>
          <div className="text-xs text-ink-soft mt-6 text-center">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </div>
          <div className="text-sm text-ink-soft mt-3 text-center">
            Have an account?{' '}
            <Link href="/login" className="text-ink underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden md:block relative overflow-hidden bg-cream-2">
        <div className="absolute inset-0">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-peach/30 blur-3xl" />
        </div>
        <div className="absolute inset-0 grid place-items-center px-12">
          <div className="bg-white border border-line rounded-2xl shadow-2xl p-6 max-w-xs">
            <div className="text-xs uppercase tracking-widest text-ink-soft mb-2">
              Today's outfit
            </div>
            <div className="font-display text-xl mb-4">Friday casual</div>
            <div className="grid grid-cols-3 gap-2">
              {['#0f0f10', '#a0522d', '#5a6f4d', '#e8b4b8', '#b48868', '#1d2b3a'].map(
                (c) => (
                  <div
                    key={c}
                    className="aspect-square rounded-md"
                    style={{ background: c }}
                  />
                )
              )}
            </div>
            <div className="text-xs text-ink-soft mt-3">6 pieces · worn 3×</div>
          </div>
        </div>
      </div>
    </div>
  );
}
