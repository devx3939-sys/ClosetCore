import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ai, uploadFromUri, cropAndUpload, uploadFromRemoteUrl } from '../../lib/ai';
import { pickImage } from '../../lib/picker';
import { CATEGORIES, type Category, type ClosetItem } from '@shared/types';

export default function ClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('closet_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data ?? []) as ClosetItem[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = items.filter((i) => {
    if (filter !== 'all' && i.category !== filter) return false;
    if (favOnly && !i.is_favorite) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !`${i.name} ${i.brand ?? ''} ${i.color ?? ''}`
          .toLowerCase()
          .includes(s)
      )
        return false;
    }
    return true;
  });

  async function toggleFav(item: ClosetItem) {
    const next = !item.is_favorite;
    setItems((cur) =>
      cur.map((i) => (i.id === item.id ? { ...i, is_favorite: next } : i))
    );
    await supabase
      .from('closet_items')
      .update({ is_favorite: next })
      .eq('id', item.id);
  }

  async function remove(item: ClosetItem) {
    Alert.alert('Delete', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((cur) => cur.filter((i) => i.id !== item.id));
          await supabase.from('closet_items').delete().eq('id', item.id);
        },
      },
    ]);
  }

  async function scanCloset(fromCamera: boolean) {
    const asset = await pickImage(fromCamera ? 'camera' : 'library');
    if (!asset) return;

    setScanBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFromUri(u.user.id, asset.uri, 'closets');
      const a = await ai.analyzeCloset(url);
      if (!a.items.length) throw new Error('No items detected.');

      // Crop each detected item out of the original photo so the card thumb is
      // a real photo of the garment instead of a flat color swatch. If the AI
      // didn't return a usable bbox for a given item, image_url stays null and
      // the card falls back to its color.
      const inserts = await Promise.all(
        a.items.map(async (it) => {
          let image_url: string | null = null;
          if (it.bounding_box) {
            try {
              const cropped = await cropAndUpload(
                u.user!.id,
                asset.uri,
                it.bounding_box
              );
              if (cropped) image_url = cropped.url;
            } catch (cropErr) {
              console.warn('crop failed for', it.name, cropErr);
            }
          }
          // Web fallback: if we couldn't get a crop but the item has enough
          // signal (brand or descriptive name), look it up online so the user
          // sees a real photo instead of a flat color swatch.
          if (!image_url && (it.brand || it.subcategory || it.name)) {
            try {
              const r = await ai.findItemImage({
                name: it.name,
                brand: it.brand,
                color: it.color_family,
                subcategory: it.subcategory,
                category: it.category,
                count: 1,
              });
              const top = r.results[0];
              if (top) {
                const { url: webUrl } = await uploadFromRemoteUrl(
                  u.user!.id,
                  top.url,
                  'items'
                );
                image_url = webUrl;
              }
            } catch (webErr) {
              console.warn('web fallback failed for', it.name, webErr);
            }
          }
          return {
            user_id: u.user!.id,
            name: it.name,
            category: it.category,
            subcategory: it.subcategory,
            color: it.color,
            color_family: it.color_family,
            brand: it.brand,
            season: it.season,
            occasion: it.occasion,
            image_url,
          };
        })
      );

      const { data: created, error } = await supabase
        .from('closet_items')
        .insert(inserts)
        .select();
      if (error) throw error;
      const newItems = (created ?? []) as ClosetItem[];
      setItems((cur) => [...newItems, ...cur]);
      Alert.alert('Done', `Added ${newItems.length} items from your closet photo.`);
    } catch (e) {
      Alert.alert(
        'Failed',
        e instanceof Error ? e.message : 'Closet scan failed'
      );
    } finally {
      setScanBusy(false);
    }
  }

  function promptScan() {
    Alert.alert('Scan whole closet', 'Take or pick a wide photo', [
      { text: 'Take photo', onPress: () => scanCloset(true) },
      { text: 'Pick from gallery', onPress: () => scanCloset(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const filterOptions: Array<Category | 'all'> = ['all', ...CATEGORIES];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>My Closet</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.btnAi}
            disabled={scanBusy}
            onPress={promptScan}
          >
            <Ionicons name="sparkles-outline" size={14} color="#1a1a1a" />
            <Text style={styles.btnAiText}>
              {scanBusy ? 'Scanning…' : 'Scan all'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/add-item')}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons
          name="search-outline"
          size={16}
          color="#888"
          style={{ marginRight: 6 }}
        />
        <TextInput
          style={{ flex: 1, fontSize: 14 }}
          placeholder="Search…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((c) => {
            const on = filter === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setFilter(c)}
                style={[styles.filterChip, on && styles.filterChipOn]}
              >
                <Text style={[styles.filterText, on && styles.filterTextOn]}>
                  {c === 'all' ? 'All' : c}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setFavOnly(!favOnly)}
            style={[styles.filterChip, favOnly && styles.filterChipOn]}
          >
            <Ionicons
              name={favOnly ? 'star' : 'star-outline'}
              size={12}
              color={favOnly ? '#fff' : '#1a1a1a'}
            />
            <Text style={[styles.filterText, favOnly && styles.filterTextOn]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ paddingVertical: 8 }}
          columnWrapperStyle={{ gap: 10 }}
          // Performance tuning for low-end devices and slow networks:
          // recycle off-screen rows, render fewer at once, defer rendering
          // until idle, and pre-compute item sizes so VirtualizedList can
          // skip ahead in the list.
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={32}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {items.length === 0
                ? 'No items. Tap Add or Scan all.'
                : 'No items match those filters.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/add-item', params: { id: item.id } })
              }
              onLongPress={() => remove(item)}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.thumb}
                  resizeMode="cover"
                  fadeDuration={150}
                />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: item.color || '#eee' },
                  ]}
                />
              )}
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => toggleFav(item)}
              >
                <Ionicons
                  name={item.is_favorite ? 'star' : 'star-outline'}
                  size={18}
                  color={item.is_favorite ? '#f1c40f' : '#fff'}
                />
              </TouchableOpacity>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.category}
                  {item.brand ? ` · ${item.brand}` : ''}
                </Text>
                {item.wear_count > 0 && (
                  <Text style={styles.cardWear}>Worn {item.wear_count}×</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#fafaf8' },
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
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnAi: {
    backgroundColor: '#ffd6b5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnAiText: { color: '#1a1a1a', fontWeight: '600' },
  searchRow: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterWrap: {
    height: 40,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 12,
    alignItems: 'center',
    height: 40,
  },
  filterChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipOn: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  filterText: { fontSize: 12, color: '#1a1a1a', textTransform: 'capitalize' },
  filterTextOn: { color: '#fff' },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  thumb: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  starBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 10, height: 64, justifyContent: 'flex-start' },
  cardTitle: { fontSize: 14, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: '#707070', marginTop: 2 },
  cardWear: { fontSize: 10, color: '#707070', marginTop: 2 },
  empty: { textAlign: 'center', color: '#707070', marginTop: 32 },
});
