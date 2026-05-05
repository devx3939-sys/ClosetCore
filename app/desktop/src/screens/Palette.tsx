import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ai, uploadFile } from '../lib/ai';
import { SEASON_PALETTES, defaultPaletteFor } from '@shared/palettes';
import type {
  ColorPalette,
  ColorSeason,
  PerSeasonPalette,
} from '@shared/types';

const SEASONS: ColorSeason[] = ['spring', 'summer', 'autumn', 'winter'];

export default function Palette() {
  const [palette, setPalette] = useState<ColorPalette | null>(null);
  const [view, setView] = useState<ColorSeason | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

  async function pickSeason(season: ColorSeason) {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
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
    if (!u.user) {
      setBusy(false);
      return;
    }
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

  async function analyzeSelfie(file: File) {
    setAiBusy(true);
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'selfies');
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
      setErr(e instanceof Error ? e.message : 'Selfie analysis failed');
    } finally {
      setAiBusy(false);
    }
  }

  if (loading) return <div className="page">Loading…</div>;

  const detail = activePalette(palette, view);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Color palette</h1>
      </header>
      <p className="muted">
        Pick a seasonal palette, or analyze a photo of yourself for a fully
        customized one.
      </p>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            ✨ Analyze your colors with AI
          </div>
          <div className="muted">
            Upload a clear, well-lit photo of your face. We'll detect your
            tones, pick your season, and customize every season's palette to
            you.
          </div>
        </div>
        <button
          className="btn ai"
          onClick={() => fileRef.current?.click()}
          disabled={aiBusy}
        >
          {aiBusy ? 'Analyzing…' : 'Upload selfie'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyzeSelfie(f);
            e.target.value = '';
          }}
        />
      </div>
      {aiBusy && (
        <div className="info">
          Analyzing your photo… this usually takes 10–15 seconds.
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {palette?.rationale && (
        <div
          style={{
            background: '#faf7f2',
            padding: 10,
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <strong>Why this season:</strong> {palette.rationale}
        </div>
      )}

      <div className="season-grid">
        {SEASONS.map((s) => {
          const meta = SEASON_PALETTES[s];
          const personalized = palette?.per_season_palettes?.[s];
          const swatchColors = personalized?.primary ?? meta.primary;
          const isBest = palette?.season === s;
          const isView = view === s;
          return (
            <button
              key={s}
              className={`season-card ${isView ? 'active' : ''}`}
              onClick={() => {
                if (palette?.per_season_palettes) {
                  if (isBest) clearSeason();
                  else setView(s);
                } else if (isBest) {
                  clearSeason();
                } else {
                  pickSeason(s);
                }
              }}
              disabled={busy || aiBusy}
              style={{ position: 'relative' }}
            >
              {isBest && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: '#ffd6b5',
                    letterSpacing: 0.5,
                  }}
                >
                  YOUR BEST
                </div>
              )}
              <div className="season-label">{meta.label}</div>
              <div className="season-strip">
                {swatchColors.map((c, i) => (
                  <span key={`${c}-${i}`} style={{ background: c }} />
                ))}
              </div>
              <div className="season-desc">
                {personalized
                  ? 'Customized to your tones'
                  : meta.description}
              </div>
            </button>
          );
        })}
      </div>

      {detail && view && (
        <div className="palette-detail">
          <h2>Your {SEASON_PALETTES[view].label} palette</h2>
          <h3>Primary</h3>
          <div className="swatches">
            {detail.primary.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="swatch"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <h3>Secondary</h3>
          <div className="swatches">
            {detail.secondary.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="swatch"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <h3>Accents</h3>
          <div className="swatches">
            {detail.accent.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="swatch"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <h3>Neutrals</h3>
          <div className="swatches">
            {detail.neutral.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="swatch"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <h3>Avoid</h3>
          <div className="swatches">
            {detail.avoid.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="swatch"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
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
