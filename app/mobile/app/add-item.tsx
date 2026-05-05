import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ai, uploadFromUri, uploadFromRemoteUrl } from '../lib/ai';
import { pickImage } from '../lib/picker';
import ColorPicker from '../components/ColorPicker';
import type { FoundImage } from '@shared/types';
import {
  CATEGORIES,
  OCCASIONS,
  SEASONS,
  type Category,
  type ClosetItem,
  type Occasion,
  type Season,
} from '@shared/types';

export default function AddItem() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editMode = !!id;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tops');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null); // local URI from picker
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null); // remote URL of saved item
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingItem, setLoadingItem] = useState(editMode);
  const [err, setErr] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FoundImage[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('closet_items')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const it = data as ClosetItem;
        setName(it.name);
        setCategory(it.category);
        setBrand(it.brand ?? '');
        setColor(it.color ?? '#000000');
        setSize(it.size ?? '');
        setSeasons(it.season ?? []);
        setOccasions(it.occasion ?? []);
        setExistingImageUrl(it.image_url);
      }
      setLoadingItem(false);
    })();
  }, [id]);

  function toggle<T extends string>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function choosePhoto(fromCamera: boolean) {
    setAiInfo(null);
    const asset = await pickImage(fromCamera ? 'camera' : 'library');
    if (!asset) return;
    setImageUri(asset.uri);
    setUploadedUrl(null);
  }

  async function autoFill() {
    if (!imageUri) {
      setErr('Pick a photo first.');
      return;
    }
    setAnalyzing(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFromUri(u.user.id, imageUri, 'items');
      setUploadedUrl(url);
      const a = await ai.analyzeItem(url);
      setName(a.name);
      setCategory(a.category);
      setBrand(a.brand ?? '');
      setColor(a.color);
      setSeasons(a.season);
      setOccasions(a.occasion);
      setAiInfo(`Auto-filled: ${a.subcategory}, ${a.color_family}.`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Auto-fill failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');

      let image_url: string | null = uploadedUrl ?? existingImageUrl;
      if (imageUri && !uploadedUrl) {
        // User picked a new local photo since last upload (or first time).
        image_url = (await uploadFromUri(u.user.id, imageUri, 'items')).url;
      }

      const fields = {
        name,
        category,
        brand: brand || null,
        color,
        size: size || null,
        season: seasons,
        occasion: occasions,
        image_url,
      };

      if (editMode) {
        const { error } = await supabase
          .from('closet_items')
          .update(fields)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('closet_items')
          .insert({ user_id: u.user.id, ...fields });
        if (error) throw error;
      }
      router.back();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function findOnline() {
    setSearchOpen(true);
    setSearching(true);
    setSearchErr(null);
    setSearchResults([]);
    try {
      const r = await ai.findItemImage({
        name: name || null,
        brand: brand || null,
        color: color || null,
        category: category || null,
        // No subcategory state in this form, but the analyze step usually fills
        // name like "Black turtleneck" — that's enough for a useful query.
        count: 8,
      });
      setSearchResults(r.results);
      if (r.results.length === 0) {
        setSearchErr('No results. Try adjusting the name or brand.');
      }
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function pickOnline(found: FoundImage) {
    setSearchOpen(false);
    setBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFromRemoteUrl(u.user.id, found.url, 'items');
      // Replace the in-progress photo state so Save uses this URL.
      setUploadedUrl(url);
      setExistingImageUrl(url);
      setImageUri(null);
    } catch (e) {
      setErr(
        e instanceof Error
          ? `Couldn't save that image: ${e.message}`
          : "Couldn't save that image"
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert('Delete', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('closet_items').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loadingItem) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const previewUri = imageUri ?? existingImageUrl;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.heading}>{editMode ? 'Edit item' : 'Add item'}</Text>

      <Text style={styles.label}>Photo</Text>
      <View style={styles.imgBox}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.img} />
        ) : (
          <Text style={styles.muted}>No photo yet</Text>
        )}
      </View>
      <View style={styles.imgBtnRow}>
        <TouchableOpacity
          style={styles.imgBtn}
          onPress={() => choosePhoto(true)}
        >
          <Ionicons name="camera-outline" size={14} color="#1a1a1a" />
          <Text style={styles.imgBtnText}>
            {editMode && existingImageUrl && !imageUri ? 'Replace photo' : 'Take photo'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.imgBtn}
          onPress={() => choosePhoto(false)}
        >
          <Ionicons name="image-outline" size={14} color="#1a1a1a" />
          <Text style={styles.imgBtnText}>Pick from gallery</Text>
        </TouchableOpacity>
      </View>
      {imageUri && !editMode && (
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={autoFill}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={14} color="#1a1a1a" />
              <Text style={styles.aiBtnText}>Auto-fill from photo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.findBtn}
        onPress={findOnline}
        disabled={busy || (!name && !brand)}
      >
        <Ionicons name="globe-outline" size={14} color="#1a1a1a" />
        <Text style={styles.findBtnText}>Find better photo online</Text>
      </TouchableOpacity>
      {aiInfo && <Text style={styles.aiInfo}>{aiInfo}</Text>}

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipOn]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Brand</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} />

      <Text style={styles.label}>Size</Text>
      <TextInput style={styles.input} value={size} onChangeText={setSize} />

      <Text style={styles.label}>Color</Text>
      <ColorPicker color={color} onChange={setColor} />

      <Text style={styles.label}>Seasons</Text>
      <View style={styles.chips}>
        {SEASONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, seasons.includes(s) && styles.chipOn]}
            onPress={() => toggle(seasons, s, setSeasons)}
          >
            <Text
              style={[styles.chipText, seasons.includes(s) && styles.chipTextOn]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Occasions</Text>
      <View style={styles.chips}>
        {OCCASIONS.map((o) => (
          <TouchableOpacity
            key={o}
            style={[styles.chip, occasions.includes(o) && styles.chipOn]}
            onPress={() => toggle(occasions, o, setOccasions)}
          >
            <Text
              style={[
                styles.chipText,
                occasions.includes(o) && styles.chipTextOn,
              ]}
            >
              {o}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {err && <Text style={styles.error}>{err}</Text>}

      <TouchableOpacity
        style={styles.btnPrimary}
        disabled={busy || !name}
        onPress={submit}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryText}>
            {editMode ? 'Save changes' : 'Save item'}
          </Text>
        )}
      </TouchableOpacity>

      {editMode && (
        <TouchableOpacity style={styles.btnDelete} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={14} color="#c0392b" />
          <Text style={styles.btnDeleteText}>Delete item</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={searchOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Pick a photo</Text>
              <TouchableOpacity onPress={() => setSearchOpen(false)}>
                <Ionicons name="close" size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            {searching && <ActivityIndicator style={{ marginVertical: 24 }} />}
            {searchErr && <Text style={styles.error}>{searchErr}</Text>}
            <FlatList
              data={searchResults}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              keyExtractor={(it, idx) => `${idx}-${it.url}`}
              contentContainerStyle={{ paddingBottom: 16, gap: 8 }}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  style={styles.foundCard}
                  onPress={() => pickOnline(r)}
                >
                  <Image
                    source={{ uri: r.thumbnail }}
                    style={styles.foundImg}
                  />
                  <Text style={styles.foundSrc} numberOfLines={1}>
                    {r.source}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fafaf8' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, color: '#707070', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
  muted: { color: '#707070' },
  error: { color: '#c0392b', marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { color: '#1a1a1a' },
  chipTextOn: { color: '#fff' },
  imgBox: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: 8,
  },
  img: { width: '100%', height: '100%' },
  imgBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  imgBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  imgBtnText: { color: '#1a1a1a', fontWeight: '500' },
  aiBtn: {
    backgroundColor: '#ffd6b5',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  aiBtnText: { color: '#1a1a1a', fontWeight: '600' },
  aiInfo: { color: '#285c33', fontSize: 12, marginTop: 6 },
  findBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  findBtnText: { color: '#1a1a1a', fontWeight: '500' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fafaf8',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '75%',
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  foundCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  foundImg: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  foundSrc: { fontSize: 10, color: '#707070', padding: 6 },
  btnPrimary: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 24,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnDeleteText: { color: '#c0392b', fontWeight: '600' },
});
