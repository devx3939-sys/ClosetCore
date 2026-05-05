import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ai, uploadFile } from '../lib/ai';
import {
  CATEGORIES,
  OCCASIONS,
  SEASONS,
  type Category,
  type Occasion,
  type Season,
} from '@shared/types';

export default function AddItem() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tops');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      let image_url = uploadedUrl;
      if (!image_url && file) {
        image_url = (await uploadFile(u.user.id, file, 'items')).url;
      }
      const { error } = await supabase.from('closet_items').insert({
        user_id: u.user.id,
        name,
        category,
        brand: brand || null,
        color,
        size: size || null,
        season: seasons,
        occasion: occasions,
        image_url,
      });
      if (error) throw error;
      nav('/closet');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Add item</h1>
      </header>
      <form className="form" onSubmit={submit}>
        <label>Photo</label>
        {(previewUrl || uploadedUrl) && (
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 10,
              border: '1px solid var(--border)',
              backgroundImage: `url(${previewUrl ?? uploadedUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginBottom: 8,
            }}
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
        />
        {file && (
          <button
            type="button"
            className="btn ai"
            onClick={autoFill}
            disabled={analyzing}
            style={{ alignSelf: 'flex-start', marginTop: 6 }}
          >
            {analyzing ? 'Analyzing photo…' : '✨ Auto-fill from photo'}
          </button>
        )}
        {aiInfo && <div className="info">{aiInfo}</div>}

        <label>Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Black turtleneck"
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

        <div className="row">
          <button type="button" className="btn" onClick={() => nav('/closet')}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save item'}
          </button>
        </div>
      </form>
    </div>
  );
}
