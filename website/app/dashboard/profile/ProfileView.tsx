'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { ai } from '@/lib/ai';
import {
  FEATURE_LABELS,
  PLAN_LABELS,
  effectivePlan,
  formatLimit,
  isUnlimited,
  type Feature,
  type Plan,
} from '@shared/plans';
import type { Profile, UsageReport } from '@shared/types';

export default function ProfileView({
  profile,
  email,
  stats,
}: {
  profile: Profile | null;
  email: string;
  stats: { items: number; outfits: number };
}) {
  const supabase = createClient();
  const [name, setName] = useState(profile?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [usageErr, setUsageErr] = useState<string | null>(null);

  const plan: Plan = effectivePlan(profile ?? {});

  useEffect(() => {
    let cancelled = false;
    ai.getUsage()
      .then((u) => {
        if (!cancelled) setUsage(u);
      })
      .catch((e) => {
        if (!cancelled) setUsageErr(e instanceof Error ? e.message : 'Usage failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setBusy(true);
    setInfo(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setBusy(false);
    await supabase
      .from('profiles')
      .upsert({ id: user.id, name, email, updated_at: new Date().toISOString() });
    setInfo('Saved.');
    setBusy(false);
  }

  // Plan upgrades / cancellation now live on /dashboard/subscription. Keep the
  // CTA here as a clear pointer rather than duplicating the checkout flow.

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Profile</h1>
      <p className="text-ink-soft text-sm mb-8">{email}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        <Stat label="Items" value={stats.items} />
        <Stat label="Outfits" value={stats.outfits} />
        <Stat
          label="Color season"
          value={profile?.color_season ?? '—'}
          capitalize
        />
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 max-w-lg mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">Your info</h2>
        <label className="block text-xs text-ink-soft mb-1">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          className="w-full border border-line rounded-lg px-3 py-2 mb-4"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="px-5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {info && <div className="text-sm text-green-700">{info}</div>}
        </div>
      </div>

      <div className="max-w-lg mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Plan</h2>
          <span
            className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full font-semibold ${
              plan === 'free'
                ? 'bg-cream-2 text-ink-soft'
                : 'bg-gradient-to-r from-rose to-peach text-ink'
            }`}
          >
            {PLAN_LABELS[plan]}
          </span>
        </div>
        {usage && (
          <div className="bg-white border border-line rounded-2xl p-5 space-y-3">
            <UsageRow
              label="Closet items"
              used={usage.item_count}
              limit={usage.item_limit}
              period="ongoing"
            />
            {(Object.keys(FEATURE_LABELS) as Feature[]).map((f) => {
              const u = usage.features[f];
              if (!u) return null;
              return (
                <UsageRow
                  key={f}
                  label={FEATURE_LABELS[f]}
                  used={u.used}
                  limit={u.limit}
                  period={u.period === 'all' ? 'lifetime' : 'this month'}
                />
              );
            })}
          </div>
        )}
        {usageErr && (
          <div className="text-sm text-red-700 mt-2">{usageErr}</div>
        )}
        <Link
          href="/dashboard/subscription"
          className="mt-4 inline-flex items-center justify-between w-full bg-white border border-line rounded-2xl px-5 py-4 hover:bg-cream-2 transition gap-3"
        >
          <span className="text-sm">
            <span className="font-medium">
              {plan === 'free'
                ? 'Try Pro free for 14 days'
                : 'Manage subscription'}
            </span>
            <span className="text-ink-soft block text-xs mt-0.5">
              {plan === 'free'
                ? 'No card required to start. Cancel anytime.'
                : 'View billing, change payment method, or cancel.'}
            </span>
          </span>
          <ExternalLink size={16} className="text-ink-soft shrink-0" />
        </Link>
      </div>

      <div className="mt-10 max-w-lg">
        <h2 className="font-display text-xl font-semibold mb-4">Account</h2>
        <div className="bg-white border border-line rounded-2xl p-6 space-y-4">
          <Row label="Email" value={email} />
          <Row label="Plan" value={PLAN_LABELS[plan]} />
          <Row label="Member since" value={fmt(profile?.created_at)} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string | number;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <div className="text-xs uppercase tracking-widest text-ink-soft mb-1">
        {label}
      </div>
      <div className={`font-display text-2xl ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  period,
}: {
  label: string;
  used: number;
  limit: number;
  period: string;
}) {
  const pct = isUnlimited(limit) ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-ink-soft">
          {used.toLocaleString()} / {formatLimit(limit)}
          <span className="text-[10px] ml-2">{period}</span>
        </span>
      </div>
      {!isUnlimited(limit) && (
        <div className="h-1.5 bg-cream-2 rounded mt-1.5 overflow-hidden">
          <div
            className={`h-full ${pct >= 100 ? 'bg-red-500' : 'bg-ink'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
