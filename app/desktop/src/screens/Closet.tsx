import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ai,
  uploadFile,
  cropAndUpload,
  uploadFromRemoteUrl,
} from '../lib/ai';
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

export default function Closet() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClosetItem | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);

  async function scanCloset(file: File) {
    setScanBusy(true);
    setScanMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'closets');
      const a = await ai.analyzeCloset(url);
      if (!a.items.length) throw new Error('No items detected.');
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
      const { data: created } = await supabase
        .from('closet_items')
        .insert(inserts)
        .select();
      const newItems = (created ?? []) as ClosetItem[];
      setItems((cur) => [...newItems, ...cur]);
      setScanMsg(`Added ${newItems.length} items from your closet photo.`);
    } catch (e) {
      setScanMsg(
        e instanceof Error ? `Failed: ${e.message}` : 'Closet scan failed'
      );
    } finally {
      setScanBusy(false);
    }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('closet_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setItems((data ?? []) as ClosetItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== 'all' && i.category !== filter) return false;
      if (favOnly && !i.is_favorite) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${i.name} ${i.brand ?? ''} ${i.color ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, search, filter, favOnly]);

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
    if (!confirm(`Delete "${item.name}"?`)) return;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    setEditing(null);
    await supabase.from('closet_items').delete().eq('id', item.id);
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>My Closet</h1>
        <div className="row" style={{ marginTop: 0 }}>
          <button
            className="btn ai"
            onClick={() => scanInput.current?.click()}
            disabled={scanBusy}
          >
            {scanBusy ? 'Scanning…' : 'Scan whole closet'}
          </button>
          <input
            ref={scanInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scanCloset(f);
              e.target.value = '';
            }}
          />
          <Link to="/add" className="btn primary">
            + Add item
          </Link>
        </div>
      </header>
      {scanMsg && <div className="info">{scanMsg}</div>}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, brand, color…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Category | 'all')}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={favOnly}
            onChange={(e) => setFavOnly(e.target.checked)}
          />
          Favorites only
        </label>
      </div>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>No items match. Add your first piece.</p>
          <Link to="/add" className="btn primary">
            + Add item
          </Link>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((i) => (
            <div
              key={i.id}
              className="card pickable"
              onClick={() => setEditing(i)}
            >
              <div
                className="thumb"
                style={{
                  background: i.color || '#eee',
                  backgroundImage: i.image_url ? `url(${i.image_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="card-body">
                <div className="card-title">
                  {i.name}
                  <button
                    className={`star ${i.is_favorite ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(i);
                    }}
                    title="Favorite"
                  >
                    ★
                  </button>
                </div>
                <div className="card-meta">
                  {i.category}
                  {i.brand ? ` · ${i.brand}` : ''}
                </div>
                {i.wear_count > 0 && (
                  <div className="card-meta" style={{ fontSize: 11 }}>
                    Worn {i.wear_count}×
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditItemModal
          item={editing}
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

function EditItemModal({
  item,
  onClose,
  onSaved,
  onDelete,
}: {
  item: ClosetItem;
  onClose: () => void;
  onSaved: (it: ClosetItem) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [color, setColor] = useState(item.color ?? '#000000');
  const [size, setSize] = useState(item.size ?? '');
  const [seasons, setSeasons] = useState<Season[]>(item.season ?? []);
  const [occasions, setOccasions] = useState<Occasion[]>(item.occasion ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FoundImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function replaceFromFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'items');
      setImageUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
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
        name,
        brand,
        color,
        category,
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
      setImageUrl(url);
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

  function toggle<T extends string>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('closet_items')
        .update({
          name,
          category,
          brand: brand || null,
          color,
          size: size || null,
          season: seasons,
          occasion: occasions,
          image_url: imageUrl,
        })
        .eq('id', item.id)
        .select()
        .single();
      if (error) throw error;
      onSaved(data as ClosetItem);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Edit item</h2>
          <button
            type="button"
            className="link"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {imageUrl && (
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 10,
              border: '1px solid var(--border)',
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginBottom: 8,
            }}
          />
        )}
        <div className="row" style={{ marginTop: 0, marginBottom: 8, justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Replace photo
          </button>
          <button
            type="button"
            className="btn"
            onClick={findOnline}
            disabled={busy || (!name && !brand)}
          >
            Find online
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) replaceFromFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <label>Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label>Brand</label>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />

        <label>Size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} />

        <label>Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <label>Seasons</label>
        <div className="chips">
          {SEASONS.map((s) => (
            <button
              type="button"
              key={s}
              className={`chip ${seasons.includes(s) ? 'on' : ''}`}
              onClick={() => toggle(seasons, s, setSeasons)}
            >
              {s}
            </button>
          ))}
        </div>

        <label>Occasions</label>
        <div className="chips">
          {OCCASIONS.map((o) => (
            <button
              type="button"
              key={o}
              className={`chip ${occasions.includes(o) ? 'on' : ''}`}
              onClick={() => toggle(occasions, o, setOccasions)}
            >
              {o}
            </button>
          ))}
        </div>

        {err && <div className="error">{err}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="link danger"
            onClick={onDelete}
          >
            Delete item
          </button>
          <div className="row" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !name}
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
      {searchOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 60 }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="modal"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Pick a photo from the web</h2>
              <button
                type="button"
                className="link"
                onClick={() => setSearchOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {searching && <div className="muted">Searching…</div>}
            {searchErr && <div className="error">{searchErr}</div>}
            {!searching && searchResults.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                {searchResults.map((r, i) => (
                  <button
                    key={`${i}-${r.url}`}
                    type="button"
                    className="card pickable"
                    onClick={() => pickOnline(r)}
                    style={{ padding: 0, cursor: 'pointer' }}
                  >
                    <div
                      className="thumb"
                      style={{
                        background: `url(${r.thumbnail}) center/cover, #eee`,
                      }}
                    />
                    <div
                      className="card-meta"
                      style={{ padding: 6, fontSize: 10 }}
                    >
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
