'use client';

import { useState } from 'react';
import { Sparkles, ExternalLink, CreditCard, Receipt, X } from 'lucide-react';
import { ai } from '@/lib/ai';
import { PLAN_LABELS, effectivePlan } from '@shared/plans';
import type { Profile } from '@shared/types';

export default function SubscriptionView({
  profile,
  email,
}: {
  profile: Profile | null;
  email: string;
}) {
  const [busy, setBusy] = useState<'upgrade' | 'portal' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const plan = effectivePlan(profile ?? {});
  const hasStripeCustomer = !!profile?.stripe_customer_id;
  const hasActiveSubscription = !!profile?.stripe_subscription_id;
  const periodEnd = profile?.plan_period_end
    ? new Date(profile.plan_period_end)
    : null;
  const now = new Date();
  // Pro with a period_end in the future = paid or trialing.
  // Pro with no period_end (or far-future like 100yrs) = admin-granted.
  // Free with a customer ID = subscription was canceled or never completed.
  const isAdminGranted =
    plan === 'pro' && periodEnd && periodEnd.getTime() - now.getTime() > 365 * 24 * 3600 * 1000 * 10;

  async function upgrade() {
    setBusy('upgrade');
    setErr(null);
    try {
      const { url } = await ai.startCheckout({
        plan: 'pro',
        return_url: `${window.location.origin}/dashboard/subscription`,
      });
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open checkout.');
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setErr(null);
    try {
      const { url } = await ai.openCustomerPortal({
        return_url: `${window.location.origin}/dashboard/subscription`,
      });
      window.location.href = url;
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Could not open the customer portal.'
      );
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Subscription</h1>
      <p className="text-ink-soft text-sm mb-8">{email}</p>

      <div className="max-w-lg space-y-5">
        <div className="bg-white border border-line rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4 gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-soft mb-1">
                Current plan
              </div>
              <div className="font-display text-3xl font-semibold">
                {PLAN_LABELS[plan]}
              </div>
            </div>
            <span
              className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full font-semibold ${
                plan === 'free'
                  ? 'bg-cream-2 text-ink-soft'
                  : 'bg-gradient-to-r from-rose to-peach text-ink'
              }`}
            >
              {plan === 'pro' ? (isAdminGranted ? 'Comp' : 'Active') : 'Free'}
            </span>
          </div>

          {plan === 'pro' && periodEnd && !isAdminGranted && (
            <div className="text-sm text-ink-soft border-t border-line/60 pt-4">
              <div className="flex justify-between items-center mb-1">
                <span>
                  {hasActiveSubscription ? 'Renews on' : 'Access until'}
                </span>
                <span className="font-medium text-ink">
                  {fmt(profile?.plan_period_end)}
                </span>
              </div>
              {!hasActiveSubscription && (
                <div className="text-xs mt-2">
                  Your subscription has been canceled but stays active until
                  this date.
                </div>
              )}
            </div>
          )}

          {plan === 'pro' && isAdminGranted && (
            <div className="text-sm text-ink-soft border-t border-line/60 pt-4">
              You have complimentary Pro access. No billing or expiry.
            </div>
          )}

          {plan === 'free' && (
            <div className="text-sm text-ink-soft border-t border-line/60 pt-4">
              {hasStripeCustomer
                ? "Your previous subscription has ended. Start a new trial whenever you're ready."
                : "Start a 14-day free trial of Pro — no card required."}
            </div>
          )}
        </div>

        {plan === 'free' && (
          <button
            onClick={upgrade}
            disabled={!!busy}
            className="w-full bg-gradient-to-r from-rose to-peach text-ink rounded-2xl p-5 text-left hover:opacity-90 disabled:opacity-50"
          >
            <div className="text-xs uppercase tracking-widest mb-1">
              Pro · 14 days free
            </div>
            <div className="font-display text-2xl font-semibold mb-1">
              $4.99 <span className="text-sm font-normal">/ month after trial</span>
            </div>
            <div className="text-xs text-ink-soft">
              Unlimited closet items, 200 auto-fills/mo, 20 closet scans/mo, AI
              outfit suggestions, palette re-analyses, and unlimited online
              photo lookup. No card required to start. Cancel anytime.
            </div>
            <div className="text-xs font-semibold mt-2 inline-flex items-center gap-1">
              <Sparkles size={12} />
              {busy === 'upgrade' ? 'Opening checkout…' : 'Try Pro free for 14 days'}
            </div>
          </button>
        )}

        {hasStripeCustomer && !isAdminGranted && (
          <div className="bg-white border border-line rounded-2xl p-6">
            <h2 className="font-display text-lg font-semibold mb-1">
              Manage subscription
            </h2>
            <p className="text-sm text-ink-soft mb-4">
              Cancel your subscription or trial, update your payment method,
              and view past invoices in the secure Stripe Customer Portal.
            </p>
            <ul className="text-sm text-ink-soft space-y-2 mb-5">
              <Bullet icon={<X size={14} />}>
                Cancel anytime — keep Pro access through the end of your
                current period
              </Bullet>
              <Bullet icon={<CreditCard size={14} />}>
                Update or remove your payment method
              </Bullet>
              <Bullet icon={<Receipt size={14} />}>
                Download invoices and billing history
              </Bullet>
            </ul>
            <button
              onClick={openPortal}
              disabled={!!busy}
              className="px-5 py-2.5 rounded-full bg-ink text-white text-sm font-medium hover:bg-black disabled:opacity-50 inline-flex items-center gap-2"
            >
              <ExternalLink size={14} />
              {busy === 'portal' ? 'Opening…' : 'Manage in Stripe'}
            </button>
          </div>
        )}

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {err}
          </div>
        )}

        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold mb-3">
            Billing details
          </h2>
          <KV label="Email" value={email} />
          <KV label="Plan" value={PLAN_LABELS[plan]} />
          {profile?.stripe_customer_id && (
            <KV
              label="Customer ID"
              value={profile.stripe_customer_id}
              mono
            />
          )}
          {profile?.stripe_subscription_id && (
            <KV
              label="Subscription ID"
              value={profile.stripe_subscription_id}
              mono
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Bullet({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-ink-soft">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-line/40 last:border-b-0 gap-3">
      <span className="text-ink-soft shrink-0">{label}</span>
      <span
        className={`font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </span>
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
