import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ai } from '../lib/ai';
import {
  FEATURE_LABELS,
  PLAN_LABELS,
  effectivePlan,
  formatLimit,
  isUnlimited,
  type Feature,
  type Plan,
} from '@shared/plans';
import type { Profile as ProfileT, UsageReport } from '@shared/types';

export default function Profile() {
  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState('');
  const [stats, setStats] = useState({ items: 0, outfits: 0 });
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const plan: Plan = effectivePlan(profile ?? {});

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    setEmail(u.user.email ?? '');

    const [p, items, outfits] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle(),
      supabase
        .from('closet_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.user.id),
      supabase
        .from('outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.user.id),
    ]);
    const pr = (p.data as ProfileT | null) ?? null;
    setProfile(pr);
    setName(pr?.name ?? '');
    setStats({ items: items.count ?? 0, outfits: outfits.count ?? 0 });

    try {
      const usageReport = await ai.getUsage();
      setUsage(usageReport);
    } catch {
      // non-fatal
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setInfo(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
    await supabase.from('profiles').upsert({
      id: u.user.id,
      name,
      email,
      updated_at: new Date().toISOString(),
    });
    setInfo('Saved.');
    setBusy(false);
  }

  // Plan upgrades / cancellation live on /subscription now.

  if (loading) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profile</h1>
      </header>
      <p className="muted" style={{ marginBottom: 20 }}>{email}</p>

      <div className="stats-grid">
        <Stat label="Items" value={stats.items} />
        <Stat label="Outfits" value={stats.outfits} />
        <Stat
          label="Color season"
          value={profile?.color_season ?? '—'}
          capitalize
        />
      </div>

      <div className="section-card">
        <h2>Your info</h2>
        <label>Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
        />
        <div className="row">
          {info && <span className="info" style={{ margin: 0 }}>{info}</span>}
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="section-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Plan</h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 999,
              background: plan === 'free' ? '#f0ece4' : '#ffd6b5',
              color: '#1a1a1a',
            }}
          >
            {PLAN_LABELS[plan]}
          </span>
        </div>
        {usage && (
          <>
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
          </>
        )}
      </div>

      <Link
        to="/subscription"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 18px',
          textDecoration: 'none',
          color: '#1a1a1a',
          maxWidth: 480,
          marginBottom: 20,
        }}
      >
        <span>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {plan === 'free'
              ? 'Try Pro free for 14 days'
              : 'Manage subscription'}
          </div>
          <div style={{ fontSize: 12, color: '#707070', marginTop: 2 }}>
            {plan === 'free'
              ? 'No card required to start. Cancel anytime.'
              : 'View billing, change payment method, or cancel.'}
          </div>
        </span>
        <span style={{ color: '#707070' }}>→</span>
      </Link>

      <div className="section-card">
        <h2>Account</h2>
        <div className="kv">
          <span>Email</span>
          <span>{email}</span>
        </div>
        <div className="kv">
          <span>Plan</span>
          <span>{PLAN_LABELS[plan]}</span>
        </div>
        <div className="kv">
          <span>Member since</span>
          <span>{fmt(profile?.created_at)}</span>
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
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={{ textTransform: capitalize ? 'capitalize' : 'none' }}
      >
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
  const over = !isUnlimited(limit) && used >= limit;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{label}</span>
        <span style={{ color: '#707070' }}>
          {used.toLocaleString()} / {formatLimit(limit)}{' '}
          <span style={{ fontSize: 9 }}>{period}</span>
        </span>
      </div>
      {!isUnlimited(limit) && (
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: '#f0ece4',
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <div
            style={{
              height: 4,
              width: `${pct}%`,
              background: over ? '#c0392b' : '#1a1a1a',
            }}
          />
        </div>
      )}
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
