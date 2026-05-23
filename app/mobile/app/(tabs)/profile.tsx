import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ai } from '../../lib/ai';
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

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState('');
  const [stats, setStats] = useState({ items: 0, outfits: 0 });
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const plan: Plan = effectivePlan(profile ?? {});

  const load = useCallback(async () => {
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
    const pr = (p.data as Profile | null) ?? null;
    setProfile(pr);
    setName(pr?.name ?? '');
    setStats({ items: items.count ?? 0, outfits: outfits.count ?? 0 });

    try {
      const usageReport = await ai.getUsage();
      setUsage(usageReport);
    } catch {
      // non-fatal — usage panel just hides
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  if (loading) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.muted}>{email}</Text>

      <View style={styles.statsRow}>
        <Stat label="Items" value={stats.items} />
        <Stat label="Outfits" value={stats.outfits} />
        <Stat label="Season" value={profile?.color_season ?? '—'} capitalize />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your info</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="What should we call you?"
          style={styles.input}
        />
        <View style={styles.saveRow}>
          {info && <Text style={styles.info}>{info}</Text>}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={save}
            disabled={busy}
          >
            <Text style={styles.btnPrimaryText}>
              {busy ? 'Saving…' : 'Save changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.planHead}>
        <Text style={styles.sectionTitle}>Plan</Text>
        <View
          style={[
            styles.planBadge,
            plan !== 'free' && styles.planBadgePro,
          ]}
        >
          <Text
            style={[
              styles.planBadgeText,
              plan !== 'free' && { color: '#1a1a1a' },
            ]}
          >
            {PLAN_LABELS[plan]}
          </Text>
        </View>
      </View>

      {usage && (
        <View style={styles.card}>
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
        </View>
      )}

      <TouchableOpacity
        style={styles.subLink}
        onPress={() => router.push('/subscription')}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.subLinkTitle}>
            {plan === 'free' ? 'Try Pro free for 14 days' : 'Manage subscription'}
          </Text>
          <Text style={styles.subLinkSub}>
            {plan === 'free'
              ? 'No card required to start. Cancel anytime.'
              : 'View billing, change payment method, or cancel.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#707070" />
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <KV label="Email" value={email} />
        <KV label="Plan" value={PLAN_LABELS[plan]} />
        <KV label="Member since" value={fmt(profile?.created_at)} />
      </View>

      <TouchableOpacity
        style={styles.signOut}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
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
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, capitalize && { textTransform: 'capitalize' }]}
      >
        {value}
      </Text>
    </View>
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
    <View style={{ marginBottom: 12 }}>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {used.toLocaleString()} / {formatLimit(limit)}{' '}
          <Text style={{ fontSize: 9, color: '#999' }}>{period}</Text>
        </Text>
      </View>
      {!isUnlimited(limit) && (
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: over ? '#c0392b' : '#1a1a1a' },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
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
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 10,
    color: '#707070',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  label: { fontSize: 12, color: '#707070', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  saveRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  info: { color: '#285c33', fontSize: 13 },
  btnPrimary: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  planHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  planBadge: {
    backgroundColor: '#f0ece4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgePro: { backgroundColor: '#ffd6b5' },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#707070',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  usageLabel: { fontSize: 13, color: '#1a1a1a' },
  usageValue: { fontSize: 12, color: '#707070' },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f0ece4',
    overflow: 'hidden',
  },
  barFill: { height: 4 },
  upgradeCard: {
    borderRadius: 14,
    padding: 16,
  },
  upgradePro: { backgroundColor: '#ffd6b5' },
  subLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  subLinkTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  subLinkSub: { fontSize: 12, color: '#707070', marginTop: 2 },
  upgradeKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  upgradePrice: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  upgradeBlurb: { fontSize: 11, color: '#707070', marginBottom: 8, lineHeight: 14 },
  upgradeCTA: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  kvLabel: { color: '#707070', fontSize: 14 },
  kvValue: { color: '#1a1a1a', fontSize: 14, fontWeight: '500' },
  signOut: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  signOutText: { color: '#1a1a1a', fontWeight: '600' },
});

// Suppress unused import for icon library — kept for future use.
void Ionicons;
