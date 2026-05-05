import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ai, uploadFromUri } from '../../lib/ai';
import { pickImage } from '../../lib/picker';
import { SEASON_PALETTES, defaultPaletteFor } from '@shared/palettes';
import type {
  ColorPalette,
  ColorSeason,
  PerSeasonPalette,
} from '@shared/types';

const SEASONS: ColorSeason[] = ['spring', 'summer', 'autumn', 'winter'];

export default function PaletteScreen() {
  const [palette, setPalette] = useState<ColorPalette | null>(null);
  const [view, setView] = useState<ColorSeason | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('color_palettes')
      .select('*')
      .eq('user_id', u.user.id)
      .maybeSingle();
    setPalette(data as ColorPalette | null);
    setView((data as ColorPalette | null)?.season ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickSeason(season: ColorSeason) {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    const next = defaultPaletteFor(season);
    await supabase.from('color_palettes').upsert({
      user_id: u.user.id,
      ...next,
      per_season_palettes: palette?.per_season_palettes ?? null,
      updated_at: new Date().toISOString(),
    });
    await supabase
      .from('profiles')
      .update({ color_season: season })
      .eq('id', u.user.id);
    await load();
    setBusy(false);
  }

  async function clearSeason() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    await supabase.from('color_palettes').upsert({
      user_id: u.user.id,
      season: null,
      primary_colors: [],
      secondary_colors: [],
      accent_colors: [],
      neutral_colors: [],
      avoid_colors: [],
      per_season_palettes: palette?.per_season_palettes ?? null,
      updated_at: new Date().toISOString(),
    });
    await supabase
      .from('profiles')
      .update({ color_season: null })
      .eq('id', u.user.id);
    setView(null);
    await load();
    setBusy(false);
  }

  async function analyzeSelfie(fromCamera: boolean) {
    const asset = await pickImage(fromCamera ? 'camera' : 'library');
    if (!asset) return;

    setAiBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFromUri(u.user.id, asset.uri, 'selfies');
      const a = await ai.analyzePalette(url);
      await supabase.from('color_palettes').upsert({
        user_id: u.user.id,
        season: a.best_season,
        primary_colors: a.primary_colors,
        secondary_colors: a.secondary_colors,
        accent_colors: a.accent_colors,
        neutral_colors: a.neutral_colors,
        avoid_colors: a.avoid_colors,
        per_season_palettes: a.per_season_palettes,
        undertone: a.undertone,
        rationale: a.rationale,
        updated_at: new Date().toISOString(),
      });
      await supabase
        .from('profiles')
        .update({
          color_season: a.best_season,
          undertone: a.undertone,
          skin_tone: a.skin_tone_hex,
        })
        .eq('id', u.user.id);
      await load();
    } catch (e) {
      Alert.alert(
        'Analysis failed',
        e instanceof Error ? e.message : 'Try again with better lighting.'
      );
    } finally {
      setAiBusy(false);
    }
  }

  const detail = activePalette(palette, view);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Color palette</Text>
      <Text style={styles.muted}>
        Pick a season, or get a fully custom set from a selfie.
      </Text>

      <View style={styles.aiBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="sparkles-outline" size={16} color="#1a1a1a" />
          <Text style={styles.aiTitle}>Analyze with AI</Text>
        </View>
        <Text style={styles.aiSub}>
          Upload or take a clear, well-lit photo of your face.
        </Text>
        <View style={styles.aiBtnRow}>
          <TouchableOpacity
            style={styles.aiBtn}
            disabled={aiBusy}
            onPress={() => analyzeSelfie(true)}
          >
            <Ionicons name="camera-outline" size={14} color="#1a1a1a" />
            <Text style={styles.aiBtnText}>Take selfie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.aiBtn}
            disabled={aiBusy}
            onPress={() => analyzeSelfie(false)}
          >
            <Ionicons name="image-outline" size={14} color="#1a1a1a" />
            <Text style={styles.aiBtnText}>Pick photo</Text>
          </TouchableOpacity>
        </View>
        {aiBusy && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" />
            <Text style={styles.muted}>Analyzing… (~10–15s)</Text>
          </View>
        )}
        {palette?.rationale && (
          <Text style={styles.rationale}>
            <Text style={{ fontWeight: '600' }}>Why this season: </Text>
            {palette.rationale}
          </Text>
        )}
      </View>

      <View style={{ gap: 10, marginTop: 8 }}>
        {SEASONS.map((s) => {
          const meta = SEASON_PALETTES[s];
          const personalized = palette?.per_season_palettes?.[s];
          const swatch = personalized?.primary ?? meta.primary;
          const isBest = palette?.season === s;
          const isView = view === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.card, isView && styles.cardActive]}
              disabled={busy || aiBusy}
              onPress={() => {
                if (palette?.per_season_palettes) {
                  if (isBest) clearSeason();
                  else setView(s);
                } else if (isBest) {
                  clearSeason();
                } else {
                  pickSeason(s);
                }
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.cardLabel}>{meta.label}</Text>
                {isBest && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>YOUR BEST</Text>
                  </View>
                )}
              </View>
              <View style={styles.strip}>
                {swatch.map((c, i) => (
                  <View
                    key={`${c}-${i}`}
                    style={[styles.stripCell, { backgroundColor: c }]}
                  />
                ))}
              </View>
              <Text style={styles.cardDesc}>
                {personalized ? 'Customized to your tones' : meta.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {detail && view && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.subtitle}>
            Your {SEASON_PALETTES[view].label} palette
          </Text>
          {(
            [
              ['Primary', detail.primary],
              ['Secondary', detail.secondary],
              ['Accents', detail.accent],
              ['Neutrals', detail.neutral],
              ['Avoid', detail.avoid],
            ] as const
          ).map(([label, colors]) => (
            <View key={label} style={{ marginBottom: 12 }}>
              <Text style={styles.groupLabel}>{label}</Text>
              <View style={styles.swatches}>
                {colors.map((c, i) => (
                  <View
                    key={`${c}-${i}`}
                    style={[styles.swatch, { backgroundColor: c }]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function activePalette(
  p: ColorPalette | null,
  view: ColorSeason | null
): PerSeasonPalette | null {
  if (!p || !view) return null;
  if (p.per_season_palettes?.[view]) return p.per_season_palettes[view];
  if (p.season === view) {
    return {
      primary: p.primary_colors,
      secondary: p.secondary_colors,
      accent: p.accent_colors,
      neutral: p.neutral_colors,
      avoid: p.avoid_colors,
    };
  }
  const meta = SEASON_PALETTES[view];
  return {
    primary: meta.primary,
    secondary: meta.secondary,
    accent: meta.accent,
    neutral: meta.neutral,
    avoid: meta.avoid,
  };
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fafaf8' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  muted: { color: '#707070', marginTop: 4, fontSize: 13 },
  aiBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
  },
  aiTitle: { fontSize: 16, fontWeight: '600' },
  aiSub: { color: '#707070', fontSize: 13, marginTop: 4, marginBottom: 8 },
  aiBtnRow: { flexDirection: 'row', gap: 8 },
  aiBtn: {
    flex: 1,
    backgroundColor: '#ffd6b5',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  aiBtnText: { color: '#1a1a1a', fontWeight: '600' },
  rationale: {
    marginTop: 10,
    fontSize: 13,
    color: '#444',
    backgroundColor: '#faf7f2',
    padding: 8,
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 14,
  },
  cardActive: { borderColor: '#1a1a1a', borderWidth: 2 },
  cardLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  badge: {
    backgroundColor: '#ffd6b5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  cardDesc: { color: '#707070', fontSize: 12, marginTop: 8 },
  strip: { flexDirection: 'row', height: 24, borderRadius: 4, overflow: 'hidden' },
  stripCell: { flex: 1 },
  groupLabel: { fontSize: 13, color: '#707070', marginBottom: 6 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
});
