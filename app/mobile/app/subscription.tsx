import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ai } from '../lib/ai';
import { PLAN_LABELS, effectivePlan, type Plan } from '@shared/plans';
import type { Profile } from '@shared/types';

export default function SubscriptionScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'upgrade' | 'portal' | null>(null);

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

  const load = useCallback(async () => {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function upgrade() {
    setBusy('upgrade');
    try {
      const { url } = await ai.startCheckout({
        plan: 'pro',
        return_url: 'closetcore://subscription',
      });
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        'Could not open checkout',
        e instanceof Error ? e.message : 'Try again later.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const { url } = await ai.openCustomerPortal({
        return_url: 'closetcore://subscription',
      });
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        'Could not open portal',
        e instanceof Error ? e.message : 'Try again later.'
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.muted}>{email}</Text>

      <View style={styles.card}>
        <View style={styles.planHead}>
          <View>
            <Text style={styles.kicker}>CURRENT PLAN</Text>
            <Text style={styles.planName}>{PLAN_LABELS[plan]}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              plan !== 'free' && styles.statusBadgePro,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                plan !== 'free' && { color: '#1a1a1a' },
              ]}
            >
              {plan === 'pro' ? (isAdminGranted ? 'COMP' : 'ACTIVE') : 'FREE'}
            </Text>
          </View>
        </View>

        {plan === 'pro' && periodEnd && !isAdminGranted && (
          <View style={styles.divider}>
            <View style={styles.rowBetween}>
              <Text style={styles.bodyMuted}>
                {hasActiveSubscription ? 'Renews on' : 'Access until'}
              </Text>
              <Text style={styles.bodyStrong}>
                {fmt(profile?.plan_period_end)}
              </Text>
            </View>
            {!hasActiveSubscription && (
              <Text style={styles.note}>
                Your subscription has been canceled but stays active until this
                date.
              </Text>
            )}
          </View>
        )}

        {plan === 'pro' && isAdminGranted && (
          <Text style={[styles.bodyMuted, styles.divider]}>
            You have complimentary Pro access. No billing or expiry.
          </Text>
        )}

        {plan === 'free' && (
          <Text style={[styles.bodyMuted, styles.divider]}>
            {hasStripeCustomer
              ? "Your previous subscription has ended. Start a new trial whenever you're ready."
              : 'Start a 14-day free trial of Pro — no card required.'}
          </Text>
        )}
      </View>

      {plan === 'free' && (
        <TouchableOpacity
          style={styles.upgradeCard}
          disabled={!!busy}
          onPress={upgrade}
        >
          <Text style={styles.kicker}>PRO · 14 DAYS FREE</Text>
          <Text style={styles.upgradePrice}>$4.99 / mo after trial</Text>
          <Text style={styles.upgradeBlurb}>
            Unlimited closet items, 200 auto-fills/mo, 20 closet scans/mo, AI
            outfit suggestions, palette re-analyses, and unlimited online photo
            lookup. No card required to start. Cancel anytime.
          </Text>
          <Text style={styles.upgradeCTA}>
            {busy === 'upgrade' ? 'Opening checkout…' : '→ Try Pro free for 14 days'}
          </Text>
        </TouchableOpacity>
      )}

      {hasStripeCustomer && !isAdminGranted && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Manage subscription</Text>
          <Text style={[styles.bodyMuted, { marginBottom: 10 }]}>
            Cancel your subscription or trial, update your payment method, and
            view past invoices in the secure Stripe Customer Portal.
          </Text>
          <Bullet text="Cancel anytime — keep Pro access through your period end" />
          <Bullet text="Update or remove your payment method" />
          <Bullet text="Download invoices and billing history" />
          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 14 }]}
            disabled={!!busy}
            onPress={openPortal}
          >
            <Ionicons name="open-outline" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>
              {busy === 'portal' ? 'Opening…' : 'Manage in Stripe'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Billing details</Text>
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
      </View>
    </ScrollView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
      <Text style={{ color: '#707070' }}>•</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 19 }}>
        {text}
      </Text>
    </View>
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
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text
        style={[
          styles.kvValue,
          mono && { fontFamily: 'monospace', fontSize: 11 },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fafaf8' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  muted: { color: '#707070', marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  planHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    color: '#707070',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: { fontSize: 28, fontWeight: '700' },
  statusBadge: {
    backgroundColor: '#f0ece4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgePro: { backgroundColor: '#ffd6b5' },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#707070',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  divider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
    marginTop: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bodyMuted: { color: '#707070', fontSize: 13, lineHeight: 19 },
  bodyStrong: { color: '#1a1a1a', fontSize: 13, fontWeight: '600' },
  note: { color: '#707070', fontSize: 12, marginTop: 6, lineHeight: 17 },
  upgradeCard: {
    backgroundColor: '#ffd6b5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  upgradePrice: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  upgradeBlurb: { fontSize: 13, color: '#444', lineHeight: 19, marginBottom: 10 },
  upgradeCTA: { fontSize: 13, fontWeight: '700' },
  btnPrimary: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  kvLabel: { color: '#707070', fontSize: 14 },
  kvValue: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
});
