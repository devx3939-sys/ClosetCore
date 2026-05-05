import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ai, uploadFromUri } from '../../lib/ai';
import { pickImage } from '../../lib/picker';
import type {
  ClosetItem,
  ColorPalette,
  Outfit,
  OutfitSuggestion,
} from '@shared/types';

export default function OutfitsScreen() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [suggBusy, setSuggBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [palette, setPalette] = useState<ColorPalette | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    const [o, i, p] = await Promise.all([
      supabase.from('outfits').select('*').order('created_at', { ascending: false }),
      supabase.from('closet_items').select('*').order('name'),
      userId
        ? supabase
            .from('color_palettes')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setOutfits((o.data ?? []) as Outfit[]);
    setItems((i.data ?? []) as ClosetItem[]);
    setPalette((p.data ?? null) as ColorPalette | null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function togglePick(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function save() {
    if (!name || picked.length === 0) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    const { error } = await supabase.from('outfits').insert({
      user_id: u.user.id,
      name,
      item_ids: picked,
    });
    if (!error) {
      setBuilding(false);
      setName('');
      setPicked([]);
      await load();
    }
    setBusy(false);
  }

  async function remove(o: Outfit) {
    Alert.alert('Delete', `Delete "${o.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setOutfits((cur) => cur.filter((x) => x.id !== o.id));
          await supabase.from('outfits').delete().eq('id', o.id);
        },
      },
    ]);
  }

  async function toggleFav(o: Outfit) {
    const next = !o.is_favorite;
    setOutfits((cur) =>
      cur.map((x) => (x.id === o.id ? { ...x, is_favorite: next } : x))
    );
    await supabase.from('outfits').update({ is_favorite: next }).eq('id', o.id);
  }

  async function outfitPhoto(fromCamera: boolean) {
    const asset = await pickImage(fromCamera ? 'camera' : 'library');
    if (!asset) return;

    setPhotoBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFromUri(u.user.id, asset.uri, 'outfits');
      const a = await ai.analyzeOutfit(url);

      const inserts = a.items.map((it) => ({
        user_id: u.user!.id,
        name: it.name,
        category: it.category,
        subcategory: it.subcategory,
        color: it.color,
        color_family: it.color_family,
        season: it.season,
        occasion: it.occasion,
      }));
      const { data: created } = await supabase
        .from('closet_items')
        .insert(inserts)
        .select();
      const newItems = (created ?? []) as ClosetItem[];
      const { data: outfit } = await supabase
        .from('outfits')
        .insert({
          user_id: u.user.id,
          name: a.outfit_name,
          item_ids: newItems.map((x) => x.id),
        })
        .select()
        .single();
      if (outfit) {
        setItems((cur) => [...newItems, ...cur]);
        setOutfits((cur) => [outfit as Outfit, ...cur]);
        Alert.alert('Saved', `"${a.outfit_name}" with ${newItems.length} new items.`);
      }
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Outfit analysis failed');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function wore(o: Outfit) {
    const today = new Date().toISOString().slice(0, 10);
    setOutfits((cur) =>
      cur.map((x) =>
        x.id === o.id
          ? { ...x, times_worn: x.times_worn + 1, last_worn: today }
          : x
      )
    );
    await supabase
      .from('outfits')
      .update({ times_worn: o.times_worn + 1, last_worn: today })
      .eq('id', o.id);
    for (const id of o.item_ids) {
      const it = items.find((x) => x.id === id);
      if (!it) continue;
      await supabase
        .from('closet_items')
        .update({ wear_count: it.wear_count + 1 })
        .eq('id', id);
    }
  }

  async function getSuggestions() {
    if (items.length < 3) {
      Alert.alert(
        'Need more items',
        'Add at least 3 items to your closet first.'
      );
      return;
    }
    setSuggBusy(true);
    try {
      // Recent outfit item-ids tell the AI what NOT to repeat — drives variety
      // across separate "Suggest" presses without making each suggestion stale.
      const recentOutfitItemIds = outfits.slice(0, 10).map((o) => o.item_ids);
      const r = await ai.suggestOutfits(items, {
        palette,
        recentOutfitItemIds,
      });
      setSuggestions(r.suggestions ?? []);
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Suggestion failed');
    } finally {
      setSuggBusy(false);
    }
  }

  async function acceptSuggestion(s: OutfitSuggestion) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from('outfits')
      .insert({
        user_id: u.user.id,
        name: s.name,
        item_ids: s.item_ids,
        occasion: s.occasion,
      })
      .select()
      .single();
    if (data) {
      setOutfits((cur) => [data as Outfit, ...cur]);
      setSuggestions((cur) => cur.filter((x) => x !== s));
    }
  }

  function promptOutfitPhoto() {
    Alert.alert('Photo of an outfit', 'Take or pick a photo', [
      { text: 'Take photo', onPress: () => outfitPhoto(true) },
      { text: 'Pick from gallery', onPress: () => outfitPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const itemMap = new Map(items.map((i) => [i.id, i]));

  if (loading && outfits.length === 0) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={{ padding: 16 }}
      data={outfits}
      keyExtractor={(o) => o.id}
      removeClippedSubviews
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.title}>Outfits</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setBuilding(!building)}
            >
              <Ionicons
                name={building ? 'close' : 'add'}
                size={16}
                color="#fff"
              />
              <Text style={styles.btnPrimaryText}>
                {building ? 'Cancel' : 'New'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.aiRow}>
            <TouchableOpacity
              style={styles.aiBtn}
              disabled={photoBusy}
              onPress={promptOutfitPhoto}
            >
              <Ionicons name="camera-outline" size={14} color="#1a1a1a" />
              <Text style={styles.aiBtnText}>
                {photoBusy ? 'Analyzing…' : 'Outfit photo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiBtn}
              disabled={suggBusy}
              onPress={getSuggestions}
            >
              <Ionicons name="sparkles-outline" size={14} color="#1a1a1a" />
              <Text style={styles.aiBtnText}>
                {suggBusy ? 'Thinking…' : 'Suggest outfits'}
              </Text>
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggBlock}>
              <Text style={styles.suggHeader}>AI suggestions</Text>
              {suggestions.map((s, i) => (
                <View key={i} style={styles.suggCard}>
                  <View style={styles.suggHead}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.suggName}>{s.name}</Text>
                      {s.vibe && (
                        <Text style={styles.suggVibe}>
                          {String(s.vibe).replace('-', ' ')}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {typeof s.score === 'number' && (
                        <Text style={styles.suggScore}>{s.score}</Text>
                      )}
                      {s.occasion && (
                        <Text style={styles.suggOcc}>{s.occasion}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.thumbRow}>
                    {s.item_ids.map((id) => {
                      const it = itemMap.get(id);
                      if (!it) return null;
                      return (
                        <View
                          key={id}
                          style={[
                            styles.miniThumb,
                            { backgroundColor: it.color || '#eee' },
                          ]}
                        >
                          {it.image_url && (
                            <Image
                              source={{ uri: it.image_url }}
                              style={{ width: '100%', height: '100%', borderRadius: 6 }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.suggRationale}>{s.rationale}</Text>
                  <View style={styles.suggActions}>
                    <TouchableOpacity
                      onPress={() => acceptSuggestion(s)}
                      style={[styles.btnPrimary, { flex: 1 }]}
                    >
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={styles.btnPrimaryText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        setSuggestions((cur) => cur.filter((x) => x !== s))
                      }
                      style={styles.btnGhost}
                    >
                      <Ionicons name="close" size={14} color="#1a1a1a" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {building && (
            <View style={styles.builder}>
              <TextInput
                style={styles.input}
                placeholder="Outfit name"
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.muted}>{picked.length} item(s) picked</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {items.map((it) => {
                  const on = picked.includes(it.id);
                  return (
                    <TouchableOpacity
                      key={it.id}
                      onPress={() => togglePick(it.id)}
                      style={[styles.pickItem, on && styles.pickItemOn]}
                    >
                      {it.image_url ? (
                        <Image
                          source={{ uri: it.image_url }}
                          style={styles.pickThumb}
                        />
                      ) : (
                        <View
                          style={[
                            styles.pickThumb,
                            { backgroundColor: it.color || '#eee' },
                          ]}
                        />
                      )}
                      <Text
                        style={[styles.pickName, on && { color: '#fff' }]}
                        numberOfLines={1}
                      >
                        {it.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.btnPrimary, { alignSelf: 'flex-end', marginTop: 8 }]}
                disabled={busy || !name || picked.length === 0}
                onPress={save}
              >
                <Text style={styles.btnPrimaryText}>{busy ? '…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No outfits yet.</Text>}
      renderItem={({ item: o }) => (
        <View style={styles.outfitCard}>
          <View style={styles.outfitHead}>
            <Text style={styles.outfitName}>{o.name}</Text>
            <TouchableOpacity onPress={() => toggleFav(o)}>
              <Ionicons
                name={o.is_favorite ? 'star' : 'star-outline'}
                size={18}
                color={o.is_favorite ? '#f1c40f' : '#ccc'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.thumbRow}>
            {o.item_ids.map((id) => {
              const it = itemMap.get(id);
              return (
                <View
                  key={id}
                  style={[
                    styles.miniThumb,
                    { backgroundColor: it?.color || '#eee' },
                  ]}
                >
                  {it?.image_url && (
                    <Image
                      source={{ uri: it.image_url }}
                      style={{ width: '100%', height: '100%', borderRadius: 6 }}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.meta}>
            Worn {o.times_worn}×
            {o.last_worn ? ` · last ${o.last_worn}` : ''}
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => wore(o)}
              style={[styles.btnPrimary, { flex: 1 }]}
            >
              <Text style={styles.btnPrimaryText}>Wore today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(o)} style={styles.btnGhost}>
              <Ionicons name="trash-outline" size={14} color="#c0392b" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fafaf8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700' },
  btnPrimary: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
  },
  muted: { color: '#707070', fontSize: 12, marginVertical: 6 },
  meta: { color: '#707070', fontSize: 12, marginBottom: 8 },
  empty: { textAlign: 'center', color: '#707070', marginTop: 32 },
  builder: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  pickItem: {
    width: 80,
    marginRight: 8,
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
  },
  pickItemOn: { backgroundColor: '#1a1a1a' },
  pickThumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#eee' },
  pickName: { fontSize: 11, marginTop: 4, color: '#444' },
  outfitCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  outfitHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  outfitName: { fontSize: 16, fontWeight: '600' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  miniThumb: { width: 48, height: 48, borderRadius: 6, overflow: 'hidden' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  aiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  aiBtn: {
    flex: 1,
    backgroundColor: '#ffd6b5',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  aiBtnText: { color: '#1a1a1a', fontWeight: '600' },
  suggBlock: { marginBottom: 16 },
  suggHeader: { fontWeight: '600', fontSize: 13, marginBottom: 8 },
  suggCard: {
    backgroundColor: '#f5efe6',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  suggHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggName: { fontSize: 14, fontWeight: '600' },
  suggOcc: {
    fontSize: 10,
    color: '#707070',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggVibe: { fontSize: 10, color: '#707070', textTransform: 'capitalize' },
  suggScore: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  suggRationale: { fontSize: 12, color: '#444', marginBottom: 10, lineHeight: 16 },
  suggActions: { flexDirection: 'row', gap: 6 },
});
