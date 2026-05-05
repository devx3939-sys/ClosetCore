'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Sparkles,
  Search,
  Star,
  Trash2,
  X,
  Check,
  Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import {
  ai,
  uploadFile,
  cropAndUpload,
  uploadFromRemoteUrl,
} from '@/lib/ai';
import ColorPicker from '@/components/ColorPicker';
import {
  CATEGORIES,
  OCCASIONS,
  SEASONS,
  type Category,
  type ClosetItem,
  type FoundImage,
  type Occasion,
  type Season,
} from '@shared/types';

export default function ClosetView({
  initialItems,
}: {
  initialItems: ClosetItem[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClosetItem | null>(null);
  const [closetBusy, setClosetBusy] = useState(false);
  const [closetMsg, setClosetMsg] = useState<string | null>(null);
  const [closetErr, setClosetErr] = useState<string | null>(null);
  const closetInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return items.filter((i) => {
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
  }, [items, search, filter, favOnly]);

  async function toggleFav(it: ClosetItem) {
    const next = !it.is_favorite;
    setItems((cur) =>
      cur.map((i) => (i.id === it.id ? { ...i, is_favorite: next } : i))
    );
    await supabase
      .from('closet_items')
      .update({ is_favorite: next })
      .eq('id', it.id);
  }

  async function remove(it: ClosetItem) {
    if (!confirm(`Delete "${it.name}"?`)) return;
    setItems((cur) => cur.filter((i) => i.id !== it.id));
    setEditing(null);
    await supabase.from('closet_items').delete().eq('id', it.id);
  }

  async function handleClosetPhoto(file: File) {
    setClosetBusy(true);
    setClosetErr(null);
    setClosetMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'closets');
      const a = await ai.analyzeCloset(url);
      if (!a.items.length) {
        throw new Error('No items detected. Try a wider shot with better lighting.');
      }
      // Crop each item out of the original photo so the thumbnail is the
      // actual garment, not a flat color swatch.
      const inserts = await Promise.all(
        a.items.map(async (it) => {
          let image_url: string | null = null;
          if (it.bounding_box) {
            try {
              const cropped = await cropAndUpload(
                u.user!.id,
                file,
                it.bounding_box
              );
              if (cropped) image_url = cropped.url;
            } catch (err) {
              console.warn('crop failed for', it.name, err);
            }
          }
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
      setClosetMsg(`Added ${newItems.length} items from your closet photo.`);
    } catch (e) {
      setClosetErr(e instanceof Error ? e.message : 'Closet scan failed');
    } finally {
      setClosetBusy(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Closet</h1>
          <p className="text-sm text-ink-soft">{items.length} items</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => closetInput.current?.click()}
            disabled={closetBusy}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-rose to-peach text-ink text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Sparkles size={16} />
            {closetBusy ? 'Scanning closet…' : 'Scan whole closet'}
          </button>
          <input
            ref={closetInput}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={closetBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleClosetPhoto(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => setAdding(true)}
            className="bg-ink text-white px-4 py-2 rounded-full inline-flex items-center gap-1.5"
          >
            <Plus size={16} />
            Add item
          </button>
        </div>
      </div>

      {closetMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-2 mb-4 flex items-center gap-2">
          <Check size={16} />
          {closetMsg}
        </div>
      )}
      {closetErr && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 mb-4">
          {closetErr}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            placeholder="Search name, brand, color…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-line rounded-full pl-9 pr-4 py-2 w-full bg-white"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Category | 'all')}
          className="border border-line rounded-full px-4 py-2 bg-white capitalize"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-soft px-3 py-2 rounded-full bg-white border border-line cursor-pointer">
          <input
            type="checkbox"
            checked={favOnly}
            onChange={(e) => setFavOnly(e.target.checked)}
          />
          Favorites
        </label>
      </div>

      {items.length === 0 ? (
        <Empty
          onAdd={() => setAdding(true)}
          onScan={() => closetInput.current?.click()}
        />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-2xl p-12 text-center text-ink-soft bg-white/40">
          No items match those filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((i) => (
            <div
              key={i.id}
              className="bg-white border border-line rounded-2xl overflow-hidden lift cursor-pointer"
              onClick={() => setEditing(i)}
            >
              {i.image_url ? (
                <img
                  src={i.image_url}
                  alt={i.name}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover bg-cream-2"
                />
              ) : (
                <div
                  className="aspect-square bg-cream-2"
                  style={{ background: i.color || '#eee' }}
                />
              )}
              <div className="p-3">
                <div className="flex justify-between items-center gap-2">
                  <div className="text-sm font-medium truncate">{i.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(i);
                    }}
                    className={`shrink-0 ${
                      i.is_favorite ? 'text-yellow-500' : 'text-gray-300'
                    }`}
                    aria-label="Favorite"
                  >
                    <Star
                      size={16}
                      fill={i.is_favorite ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
                <div className="text-xs text-ink-soft truncate">
                  {i.category}
                  {i.brand ? ` · ${i.brand}` : ''}
                </div>
                {i.wear_count > 0 && (
                  <div className="text-[10px] text-ink-soft mt-0.5">
                    Worn {i.wear_count}×
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <ItemForm
          onClose={() => setAdding(false)}
          onSaved={(it) => {
            setItems((cur) => [it, ...cur]);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <ItemForm
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(it) => {
            setItems((cur) => cur.map((x) => (x.id === it.id ? it : x)));
            setEditing(null);
          }}
          onDelete={() => remove(editing)}
        />
      )}
    </div>
  );
}

function Empty({ onAdd, onScan }: { onAdd: () => void; onScan: () => void }) {
  return (
    <div className="border border-dashed border-line rounded-2xl p-16 text-center bg-white/40">
      <h3 className="font-display text-2xl font-semibold mb-2">
        Your closet is empty
      </h3>
      <p className="text-ink-soft text-sm mb-6 max-w-sm mx-auto">
        Add a piece manually, or take one wide photo of your closet and let AI
        catalog every item at once.
      </p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={onScan}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-rose to-peach text-ink hover:opacity-90 inline-flex items-center gap-2"
        >
          <Sparkles size={16} />
          Scan whole closet
        </button>
        <button
          onClick={onAdd}
          className="px-5 py-2.5 rounded-full bg-ink text-white hover:bg-black inline-flex items-center gap-1.5"
        >
          <Plus size={16} />
          Add manually
        </button>
      </div>
    </div>
  );
}

function ItemForm({
  existing,
  onClose,
  onSaved,
  onDelete,
}: {
  existing?: ClosetItem;
  onClose: () => void;
  onSaved: (it: ClosetItem) => void;
  onDelete?: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'tops');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [color, setColor] = useState(existing?.color ?? '#000000');
  const [size, setSize] = useState(existing?.size ?? '');
  const [seasons, setSeasons] = useState<Season[]>(existing?.season ?? []);
  const [occasions, setOccasions] = useState<Occasion[]>(existing?.occasion ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FoundImage[]>([]);

  const editMode = !!existing;

  function toggle<T extends string>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function handlePick(f: File | null) {
    setFile(f);
    setUploadedUrl(null);
    setAiInfo(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function autoFill() {
    if (!file) {
      setErr('Pick a photo first.');
      return;
    }
    setAnalyzing(true);
    setErr(null);
    setAiInfo(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'items');
      setUploadedUrl(url);
      const a = await ai.analyzeItem(url);
      setName(a.name);
      setCategory(a.category);
      setBrand(a.brand ?? '');
      setColor(a.color);
      setSeasons(a.season);
      setOccasions(a.occasion);
      setAiInfo(`Auto-filled: ${a.subcategory}, ${a.color_family}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Auto-fill failed');
    } finally {
      setAnalyzing(false);
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
      setUploadedUrl(url);
      setPreviewUrl(url);
      setFile(null);
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');

      let image_url = uploadedUrl ?? existing?.image_url ?? null;
      if (!uploadedUrl && file) {
        const { url } = await uploadFile(u.user.id, file, 'items');
        image_url = url;
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
        const { data, error } = await supabase
          .from('closet_items')
          .update(fields)
          .eq('id', existing!.id)
          .select()
          .single();
        if (error) throw error;
        onSaved(data as ClosetItem);
      } else {
        const { data, error } = await supabase
          .from('closet_items')
          .insert({ user_id: u.user.id, ...fields })
          .select()
          .single();
        if (error) throw error;
        onSaved(data as ClosetItem);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-display text-2xl font-semibold">
            {editMode ? 'Edit item' : 'Add item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <Field label="Photo">
          {(previewUrl || existing?.image_url) && (
            <div
              className="w-32 h-32 rounded-lg border border-line mb-2"
              style={{
                background: `url(${previewUrl ?? existing?.image_url}) center/cover`,
              }}
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
            className="text-sm block mb-2"
          />
          {!editMode && file && (
            <button
              type="button"
              onClick={autoFill}
              disabled={analyzing}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-rose to-peach text-ink text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Sparkles size={14} />
              {analyzing ? 'Analyzing photo…' : 'Auto-fill from photo'}
            </button>
          )}
          <button
            type="button"
            onClick={findOnline}
            disabled={busy || (!name && !brand)}
            className="ml-2 px-4 py-2 rounded-full border border-line bg-white text-sm hover:bg-cream-2 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Globe size={14} />
            Find better photo online
          </button>
          {aiInfo && <div className="text-xs text-green-700 mt-2">{aiInfo}</div>}
        </Field>

        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 w-full"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="border border-line rounded-lg px-3 py-2 w-full bg-white capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="border border-line rounded-lg px-3 py-2 w-full"
            />
          </Field>
          <Field label="Size">
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="border border-line rounded-lg px-3 py-2 w-full"
            />
          </Field>
        </div>
        <Field label="Color">
          <ColorPicker color={color} onChange={setColor} />
        </Field>

        <Field label="Seasons">
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                on={seasons.includes(s)}
                onClick={() => toggle(seasons, s, setSeasons)}
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Occasions">
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <Chip
                key={o}
                on={occasions.includes(o)}
                onClick={() => toggle(occasions, o, setOccasions)}
              >
                {o}
              </Chip>
            ))}
          </div>
        </Field>

        {err && <div className="text-sm text-red-600 mt-2">{err}</div>}

        <div className="flex gap-2 justify-between mt-5">
          {editMode && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 text-sm text-red-600 hover:underline inline-flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Delete item
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-line rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name}
              className="bg-ink text-white px-5 py-2 rounded-full disabled:opacity-50"
            >
              {busy ? 'Saving…' : editMode ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </form>
      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] grid place-items-center p-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-xl font-semibold">
                Pick a photo from the web
              </h3>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-ink-soft hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>
            {searching && (
              <div className="text-sm text-ink-soft py-6 text-center">
                Searching…
              </div>
            )}
            {searchErr && (
              <div className="text-sm text-red-700 mb-3">{searchErr}</div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {searchResults.map((r, i) => (
                  <button
                    key={`${i}-${r.url}`}
                    type="button"
                    onClick={() => pickOnline(r)}
                    className="bg-white border border-line rounded-xl overflow-hidden text-left hover:ring-2 hover:ring-ink"
                  >
                    <div
                      className="aspect-square bg-cream-2"
                      style={{
                        background: `url(${r.thumbnail}) center/cover`,
                      }}
                    />
                    <div className="px-2 py-1 text-[10px] text-ink-soft truncate">
                      {r.source}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <div className="text-xs text-ink-soft mb-1">{label}</div>
      {children}
    </label>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm border capitalize transition ${
        on ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:bg-cream-2'
      }`}
    >
      {children}
    </button>
  );
}
