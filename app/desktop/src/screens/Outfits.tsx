import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ai, uploadFile } from '../lib/ai';
import {
  OCCASIONS,
  type ClosetItem,
  type ColorPalette,
  type Occasion,
  type Outfit,
  type OutfitSuggestion,
} from '@shared/types';

export default function Outfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [suggBusy, setSuggBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [suggErr, setSuggErr] = useState<string | null>(null);
  const [suggOcc, setSuggOcc] = useState<Occasion | ''>('');
  const [palette, setPalette] = useState<ColorPalette | null>(null);

  async function getSuggestions() {
    if (items.length < 3) {
      setSuggErr('Add at least 3 items to your closet first.');
      return;
    }
    setSuggBusy(true);
    setSuggErr(null);
    try {
      const recentOutfitItemIds = outfits.slice(0, 10).map((o) => o.item_ids);
      const r = await ai.suggestOutfits(items, {
        occasion: suggOcc || undefined,
        palette,
        recentOutfitItemIds,
      });
      setSuggestions(r.suggestions ?? []);
      if (!r.suggestions?.length) {
        setSuggErr('No suggestions returned. Try adding more variety to your closet.');
      }
    } catch (e) {
      setSuggErr(e instanceof Error ? e.message : 'Suggestion failed');
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

  async function outfitPhoto(file: File) {
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'outfits');
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
        setPhotoMsg(
          `Saved "${a.outfit_name}" with ${newItems.length} new items.`
        );
      }
    } catch (e) {
      setPhotoMsg(
        e instanceof Error ? `Failed: ${e.message}` : 'Outfit photo failed'
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

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
    if (!confirm(`Delete outfit "${o.name}"?`)) return;
    setOutfits((cur) => cur.filter((x) => x.id !== o.id));
    await supabase.from('outfits').delete().eq('id', o.id);
  }

  async function toggleFav(o: Outfit) {
    const next = !o.is_favorite;
    setOutfits((cur) =>
      cur.map((x) => (x.id === o.id ? { ...x, is_favorite: next } : x))
    );
    await supabase.from('outfits').update({ is_favorite: next }).eq('id', o.id);
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

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Outfits</h1>
        <div className="row" style={{ marginTop: 0 }}>
          <button
            className="btn ai"
            onClick={() => photoInput.current?.click()}
            disabled={photoBusy}
          >
            {photoBusy ? 'Analyzing…' : 'Photo of an outfit'}
          </button>
          <select
            value={suggOcc}
            onChange={(e) => setSuggOcc(e.target.value as Occasion | '')}
            style={{ padding: '8px 12px' }}
          >
            <option value="">Any occasion</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            className="btn ai"
            onClick={getSuggestions}
            disabled={suggBusy}
          >
            {suggBusy ? 'Thinking…' : 'Suggest outfits'}
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) outfitPhoto(f);
              e.target.value = '';
            }}
          />
          <button
            className="btn primary"
            onClick={() => setBuilding(true)}
            disabled={building}
          >
            + New outfit
          </button>
        </div>
      </header>
      {photoMsg && <div className="info">{photoMsg}</div>}
      {suggErr && <div className="error">{suggErr}</div>}

      {suggestions.length > 0 && (
        <div className="builder" style={{ background: '#f5efe6' }}>
          <h2 style={{ marginBottom: 8 }}>AI suggestions</h2>
          <div className="outfit-list">
            {suggestions.map((s, i) => (
              <div key={i} className="outfit-card">
                <div className="outfit-head">
                  <div>
                    <h3 style={{ margin: 0 }}>{s.name}</h3>
                    {s.vibe && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#707070',
                          textTransform: 'capitalize',
                        }}
                      >
                        {String(s.vibe).replace('-', ' ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {typeof s.score === 'number' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          background: '#1a1a1a',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                        title="Stylist score"
                      >
                        {s.score}
                      </span>
                    )}
                    {s.occasion && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#707070',
                          background: '#fff',
                          border: '1px solid var(--border)',
                          padding: '2px 8px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {s.occasion}
                      </span>
                    )}
                  </div>
                </div>
                <div className="outfit-thumbs">
                  {s.item_ids.map((id) => {
                    const it = items.find((x) => x.id === id);
                    if (!it) return null;
                    return (
                      <div
                        key={id}
                        className="mini-thumb"
                        title={it.name}
                        style={{
                          background: it.color || '#eee',
                          backgroundImage: it.image_url
                            ? `url(${it.image_url})`
                            : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {s.rationale}
                </div>
                <div className="row">
                  <button
                    className="btn primary"
                    onClick={() => acceptSuggestion(s)}
                  >
                    Save
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      setSuggestions((cur) => cur.filter((x) => x !== s))
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {building && (
        <div className="builder">
          <h2>Build an outfit</h2>
          <input
            placeholder="Outfit name (e.g. Friday casual)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="muted">Pick items ({picked.length} selected)</div>
          <div className="grid">
            {items.map((i) => (
              <div
                key={i.id}
                className={`card pickable ${picked.includes(i.id) ? 'picked' : ''}`}
                onClick={() => togglePick(i.id)}
              >
                <div
                  className="thumb"
                  style={{
                    background: i.color || '#eee',
                    backgroundImage: i.image_url
                      ? `url(${i.image_url})`
                      : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="card-body">
                  <div className="card-title">{i.name}</div>
                  <div className="card-meta">{i.category}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setBuilding(false);
                setName('');
                setPicked([]);
              }}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy || !name || picked.length === 0}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save outfit'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : outfits.length === 0 ? (
        <div className="empty">No outfits yet.</div>
      ) : (
        <div className="outfit-list">
          {outfits.map((o) => (
            <div key={o.id} className="outfit-card">
              <div className="outfit-head">
                <h3>{o.name}</h3>
                <button
                  className={`star ${o.is_favorite ? 'on' : ''}`}
                  onClick={() => toggleFav(o)}
                  title="Favorite"
                >
                  ★
                </button>
              </div>
              <div className="outfit-thumbs">
                {o.item_ids.map((id) => {
                  const it = itemMap.get(id);
                  return (
                    <div
                      key={id}
                      className="mini-thumb"
                      title={it?.name}
                      style={{
                        background: it?.color || '#eee',
                        backgroundImage: it?.image_url
                          ? `url(${it.image_url})`
                          : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  );
                })}
              </div>
              <div className="outfit-meta">
                Worn {o.times_worn}×
                {o.last_worn ? ` · last ${o.last_worn}` : ''}
              </div>
              <div className="row">
                <button className="btn primary" onClick={() => wore(o)}>
                  Wore today
                </button>
                <button className="link danger" onClick={() => remove(o)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
