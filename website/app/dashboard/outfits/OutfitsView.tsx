'use client';

import { useState } from 'react';
import {
  Plus,
  Sparkles,
  Star,
  Trash2,
  Camera,
  Wand2,
  Check,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { ai, uploadFile } from '@/lib/ai';
import {
  OCCASIONS,
  type ClosetItem,
  type ColorPalette,
  type Occasion,
  type Outfit,
  type OutfitSuggestion,
} from '@shared/types';

export default function OutfitsView({
  initialOutfits,
  items,
  palette,
}: {
  initialOutfits: Outfit[];
  items: ClosetItem[];
  palette: ColorPalette | null;
}) {
  const supabase = createClient();
  const [outfits, setOutfits] = useState(initialOutfits);
  const [allItems, setAllItems] = useState(items);
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const [suggBusy, setSuggBusy] = useState(false);
  const [suggErr, setSuggErr] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [suggOcc, setSuggOcc] = useState<Occasion | ''>('');

  const itemMap = new Map(allItems.map((i) => [i.id, i]));

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
    const { data } = await supabase
      .from('outfits')
      .insert({ user_id: u.user.id, name, item_ids: picked })
      .select()
      .single();
    if (data) {
      setOutfits((cur) => [data as Outfit, ...cur]);
      setBuilding(false);
      setName('');
      setPicked([]);
    }
    setBusy(false);
  }

  async function remove(o: Outfit) {
    if (!confirm(`Delete "${o.name}"?`)) return;
    setOutfits((cur) => cur.filter((x) => x.id !== o.id));
    await supabase.from('outfits').delete().eq('id', o.id);
  }

  async function toggleFav(o: Outfit) {
    const next = !o.is_favorite;
    setOutfits((cur) =>
      cur.map((x) => (x.id === o.id ? { ...x, is_favorite: next } : x))
    );
    await supabase
      .from('outfits')
      .update({ is_favorite: next })
      .eq('id', o.id);
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
      .update({
        times_worn: o.times_worn + 1,
        last_worn: today,
      })
      .eq('id', o.id);
    for (const id of o.item_ids) {
      const it = itemMap.get(id);
      if (!it) continue;
      await supabase
        .from('closet_items')
        .update({ wear_count: it.wear_count + 1 })
        .eq('id', id);
    }
  }

  async function handleOutfitPhoto(file: File) {
    setPhotoBusy(true);
    setPhotoErr(null);
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
      const { data: created, error: e1 } = await supabase
        .from('closet_items')
        .insert(inserts)
        .select();
      if (e1) throw e1;
      const newItems = (created ?? []) as ClosetItem[];

      const { data: outfit, error: e2 } = await supabase
        .from('outfits')
        .insert({
          user_id: u.user.id,
          name: a.outfit_name,
          item_ids: newItems.map((x) => x.id),
        })
        .select()
        .single();
      if (e2) throw e2;

      setAllItems((cur) => [...newItems, ...cur]);
      setOutfits((cur) => [outfit as Outfit, ...cur]);
      setPhotoMsg(
        `Saved "${a.outfit_name}" with ${newItems.length} new items.`
      );
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : 'Outfit photo failed');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function getSuggestions() {
    setSuggBusy(true);
    setSuggErr(null);
    try {
      const recentOutfitItemIds = outfits.slice(0, 10).map((o) => o.item_ids);
      const result = await ai.suggestOutfits(allItems, {
        occasion: suggOcc || undefined,
        palette,
        recentOutfitItemIds,
      });
      setSuggestions(result.suggestions ?? []);
      if (!result.suggestions?.length) {
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

  return (
    <div>
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Outfits</h1>
          <p className="text-sm text-ink-soft">
            {outfits.length} saved ·{' '}
            {outfits.reduce((s, o) => s + o.times_worn, 0)} total wears
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="px-4 py-2 rounded-full bg-gradient-to-r from-rose to-peach text-ink text-sm font-medium cursor-pointer hover:opacity-90 inline-flex items-center gap-2">
            <Camera size={16} />
            {photoBusy ? 'Analyzing…' : 'Photo of an outfit'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={photoBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleOutfitPhoto(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => setBuilding(!building)}
            className="bg-ink text-white px-4 py-2 rounded-full inline-flex items-center gap-1.5"
          >
            {building ? <X size={16} /> : <Plus size={16} />}
            {building ? 'Cancel' : 'New outfit'}
          </button>
        </div>
      </div>

      {photoMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-2 mb-4 flex items-center gap-2">
          <Check size={16} />
          {photoMsg}
        </div>
      )}
      {photoErr && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 mb-4">
          {photoErr}
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl p-5 mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rose/30 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap gap-3 items-center justify-between">
          <div className="max-w-md">
            <div className="font-display text-xl font-semibold mb-1 inline-flex items-center gap-2">
              <Wand2 size={18} />
              AI outfit suggestions
            </div>
            <p className="text-sm text-ink-soft">
              ClosetCore builds outfits from what you already own using color theory
              and occasion match.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={suggOcc}
              onChange={(e) => setSuggOcc(e.target.value as Occasion | '')}
              className="border border-line rounded-full px-4 py-2 bg-white capitalize text-sm"
            >
              <option value="">Any occasion</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o} className="capitalize">
                  {o}
                </option>
              ))}
            </select>
            <button
              onClick={getSuggestions}
              disabled={suggBusy || allItems.length < 3}
              className="px-5 py-2 rounded-full bg-ink text-white hover:bg-black transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Sparkles size={16} />
              {suggBusy ? 'Thinking…' : 'Suggest outfits'}
            </button>
          </div>
        </div>
        {suggErr && (
          <div className="text-sm text-red-700 mt-3 relative">{suggErr}</div>
        )}
        {suggestions.length > 0 && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 relative">
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                s={s}
                items={itemMap}
                onAccept={() => acceptSuggestion(s)}
                onDismiss={() =>
                  setSuggestions((cur) => cur.filter((x) => x !== s))
                }
              />
            ))}
          </div>
        )}
      </div>

      {building && (
        <div className="bg-white border border-line rounded-2xl p-5 mb-6">
          <input
            placeholder="Outfit name (e.g. Friday casual)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 w-full mb-3"
            autoFocus
          />
          <div className="text-sm text-ink-soft mb-3">
            {picked.length} item(s) selected
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-72 overflow-auto">
            {allItems.length === 0 ? (
              <div className="col-span-full text-center py-10 text-ink-soft text-sm">
                Add items to your closet first.
              </div>
            ) : (
              allItems.map((i) => {
                const on = picked.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => togglePick(i.id)}
                    className={`bg-white border rounded-xl overflow-hidden text-left transition ${
                      on ? 'border-ink ring-2 ring-ink' : 'border-line'
                    }`}
                  >
                    <div
                      className="aspect-square"
                      style={{
                        background: i.image_url
                          ? `url(${i.image_url}) center/cover`
                          : i.color || '#eee',
                      }}
                    />
                    <div className="p-2 text-xs truncate">{i.name}</div>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={save}
              disabled={busy || !name || picked.length === 0}
              className="bg-ink text-white px-5 py-2 rounded-full disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save outfit'}
            </button>
          </div>
        </div>
      )}

      {outfits.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {outfits.map((o) => (
            <div
              key={o.id}
              className="bg-white border border-line rounded-2xl p-5 lift"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-display text-lg font-semibold">{o.name}</h3>
                <button
                  onClick={() => toggleFav(o)}
                  className={
                    o.is_favorite ? 'text-yellow-500' : 'text-gray-300'
                  }
                  aria-label="Favorite"
                >
                  <Star
                    size={18}
                    fill={o.is_favorite ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {o.item_ids.map((id) => {
                  const it = itemMap.get(id);
                  return (
                    <div
                      key={id}
                      title={it?.name}
                      className="w-12 h-12 rounded border border-line"
                      style={{
                        background: it?.image_url
                          ? `url(${it.image_url}) center/cover`
                          : it?.color || '#eee',
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-ink-soft mb-3">
                <span>
                  Worn {o.times_worn}×
                  {o.last_worn ? ` · last ${fmt(o.last_worn)}` : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => wore(o)}
                  className="flex-1 px-3 py-1.5 rounded-full bg-ink text-white text-sm hover:bg-black"
                >
                  Wore today
                </button>
                <button
                  onClick={() => remove(o)}
                  className="px-3 py-1.5 rounded-full border border-line text-sm hover:bg-cream-2 inline-flex items-center gap-1"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  s,
  items,
  onAccept,
  onDismiss,
}: {
  s: OutfitSuggestion;
  items: Map<string, ClosetItem>;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-cream-2/60 border border-line rounded-xl p-4">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div>
          <h4 className="font-display text-base font-semibold">{s.name}</h4>
          {s.vibe && (
            <span className="text-[10px] text-ink-soft capitalize">
              {s.vibe.replace('-', ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {typeof s.score === 'number' && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ink text-white"
              title="Stylist score"
            >
              {s.score}
            </span>
          )}
          {s.occasion && (
            <span className="text-[10px] uppercase tracking-widest text-ink-soft px-2 py-0.5 rounded-full bg-white border border-line">
              {s.occasion}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {s.item_ids.map((id) => {
          const it = items.get(id);
          if (!it) return null;
          return (
            <div
              key={id}
              title={it.name}
              className="w-10 h-10 rounded border border-line"
              style={{
                background: it.image_url
                  ? `url(${it.image_url}) center/cover`
                  : it.color || '#eee',
              }}
            />
          );
        })}
      </div>
      <p className="text-xs text-ink-soft mb-3 leading-relaxed">{s.rationale}</p>
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 px-3 py-1.5 rounded-full bg-ink text-white text-xs hover:bg-black inline-flex items-center justify-center gap-1.5"
        >
          <Check size={12} />
          Save
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-full border border-line text-xs hover:bg-white"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function Empty() {
  return (
    <div className="border border-dashed border-line rounded-2xl p-16 text-center bg-white/40">
      <h3 className="font-display text-xl font-semibold mb-1">
        No outfits yet
      </h3>
      <p className="text-ink-soft text-sm">
        Build manually, photograph an existing one, or use AI suggestions above.
      </p>
    </div>
  );
}
