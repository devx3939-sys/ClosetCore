import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ai } from '../lib/ai';
import { PLAN_LABELS, effectivePlan, type Plan } from '@shared/plans';
import type { Profile } from '@shared/types';

export default function Subscription() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'upgrade' | 'portal' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const plan: Plan = effectivePlan(profile ?? {});
  const hasStripeCustomer = !!profile?.stripe_customer_id;
  const hasActiveSubscription = !!profile?.stripe_subscription_id;
  const periodEnd = profile?.plan_period_end
    ? new Date(profile.plan_period_end)
    : null;
  const isAdminGranted =
    plan === 'pro' &&
    periodEnd &&
    periodEnd.getTime() - Date.now() > 365 * 24 * 3600 * 1000 * 10;

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    setEmail(u.user.email ?? '');
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.user.id)
      .maybeSingle();
    setProfile((data ?? null) as Profile | null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function upgrade() {
    setBusy('upgrade');
    setErr(null);
    try {
      const { url } = await ai.startCheckout({
        plan: 'pro',
        return_url: window.location.origin + '/subscription',
      });
      window.open(url, '_blank');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open checkout.');
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setErr(null);
    try {
      const { url } = await ai.openCustomerPortal({
        return_url: window.location.origin + '/subscription',
      });
      window.open(url, '_blank');
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : 'Could not open the customer portal.'
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Subscription</h1>
      </header>
      <p className="muted" style={{ marginBottom: 20 }}>
        {email}
      </p>

      <div className="section-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: '#707070',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              Current plan
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {PLAN_LABELS[plan]}
            </div>
          </div>
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
            {plan === 'pro' ? (isAdminGranted ? 'Comp' : 'Active') : 'Free'}
          </span>
        </div>

        {plan === 'pro' && periodEnd && !isAdminGranted && (
          <div
            style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#707070' }}>
                {hasActiveSubscription ? 'Renews on' : 'Access until'}
              </span>
              <span style={{ fontWeight: 600 }}>
                {fmt(profile?.plan_period_end)}
              </span>
            </div>
            {!hasActiveSubscription && (
              <div style={{ fontSize: 11, color: '#707070', marginTop: 6 }}>
                Your subscription has been canceled but stays active until
                this date.
              </div>
            )}
          </div>
        )}

        {plan === 'pro' && isAdminGranted && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              fontSize: 13,
              color: '#707070',
            }}
          >
            You have complimentary Pro access. No billing or expiry.
          </div>
        )}

        {plan === 'free' && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              fontSize: 13,
              color: '#707070',
            }}
          >
            {hasStripeCustomer
              ? "Your previous subscription has ended. Start a new trial whenever you're ready."
              : 'Start a 14-day free trial of Pro — no card required.'}
          </div>
        )}
      </div>

      {plan === 'free' && (
        <button
          onClick={upgrade}
          disabled={!!busy}
          style={{
            background: 'linear-gradient(90deg, #e8b4b8, #ffd6b5)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'left',
            border: 'none',
            cursor: 'pointer',
            opacity: busy ? 0.5 : 1,
            maxWidth: 480,
            width: '100%',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            PRO · 14 DAYS FREE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>
            $4.99 <span style={{ fontSize: 12, fontWeight: 400 }}>/ mo after trial</span>
          </div>
          <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>
            Unlimited closet items, 200 auto-fills/mo, 20 closet scans/mo, AI
            outfit suggestions, palette re-analyses, unlimited online photo
            lookup. No card required to start. Cancel anytime.
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>
            {busy === 'upgrade' ? 'Opening checkout…' : '→ Try Pro free for 14 days'}
          </div>
        </button>
      )}

      {hasStripeCustomer && !isAdminGranted && (
        <div className="section-card">
          <h2>Manage subscription</h2>
          <p style={{ color: '#707070', fontSize: 13, marginBottom: 12 }}>
            Cancel your subscription or trial, update your payment method, and
            view past invoices in the secure Stripe Customer Portal.
          </p>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: '#444', lineHeight: 1.6, marginBottom: 16 }}>
            <li>Cancel anytime — keep Pro access through the end of your period</li>
            <li>Update or remove your payment method</li>
            <li>Download invoices and billing history</li>
          </ul>
          <button
            className="btn primary"
            onClick={openPortal}
            disabled={!!busy}
          >
            {busy === 'portal' ? 'Opening…' : 'Manage in Stripe →'}
          </button>
        </div>
      )}

      {err && <div className="error">{err}</div>}

      <div className="section-card">
        <h2>Billing details</h2>
        <div className="kv">
          <span>Email</span>
          <span>{email}</span>
        </div>
        <div className="kv">
          <span>Plan</span>
          <span>{PLAN_LABELS[plan]}</span>
        </div>
        {profile?.stripe_customer_id && (
          <div className="kv">
            <span>Customer ID</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {profile.stripe_customer_id}
            </span>
          </div>
        )}
        {profile?.stripe_subscription_id && (
          <div className="kv">
            <span>Subscription ID</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {profile.stripe_subscription_id}
            </span>
          </div>
        )}
      </div>
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
