'use client';

import { useState } from 'react';
import { Sparkles, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { ai, uploadFile } from '@/lib/ai';
import { SEASON_PALETTES, defaultPaletteFor } from '@shared/palettes';
import type {
  ColorPalette,
  ColorSeason,
  PerSeasonPalette,
} from '@shared/types';

const SEASONS: ColorSeason[] = ['spring', 'summer', 'autumn', 'winter'];

export default function PaletteView({
  initial,
}: {
  initial: ColorPalette | null;
}) {
  const supabase = createClient();
  const [palette, setPalette] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [view, setView] = useState<ColorSeason | null>(
    initial?.season ?? null
  );

  async function pickSeason(season: ColorSeason) {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    const next = defaultPaletteFor(season);
    const { data } = await supabase
      .from('color_palettes')
      .upsert({
        user_id: u.user.id,
        ...next,
        per_season_palettes: palette?.per_season_palettes ?? null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    await supabase
      .from('profiles')
      .update({ color_season: season })
      .eq('id', u.user.id);
    if (data) {
      setPalette(data as ColorPalette);
      setView(season);
    }
    setBusy(false);
  }

  async function clearSeason() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    const { data } = await supabase
      .from('color_palettes')
      .upsert({
        user_id: u.user.id,
        season: null,
        primary_colors: [],
        secondary_colors: [],
        accent_colors: [],
        neutral_colors: [],
        avoid_colors: [],
        per_season_palettes: palette?.per_season_palettes ?? null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    await supabase
      .from('profiles')
      .update({ color_season: null })
      .eq('id', u.user.id);
    if (data) {
      setPalette(data as ColorPalette);
      setView(null);
    }
    setBusy(false);
  }

  async function analyzeSelfie(file: File) {
    setAiBusy(true);
    setAiErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const { url } = await uploadFile(u.user.id, file, 'selfies');
      const a = await ai.analyzePalette(url);

      const { data, error } = await supabase
        .from('color_palettes')
        .upsert({
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
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from('profiles')
        .update({
          color_season: a.best_season,
          undertone: a.undertone,
          skin_tone: a.skin_tone_hex,
        })
        .eq('id', u.user.id);

      setPalette(data as ColorPalette);
      setView(a.best_season);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'Selfie analysis failed');
    } finally {
      setAiBusy(false);
    }
  }

  // Which palette to show in the detail block.
  const detail = activePalette(palette, view);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Color palette</h1>
      <p className="text-ink-soft text-sm mb-6">
        Pick the seasonal palette that suits you, or let AI analyze your photo
        for a fully custom set.
      </p>

      {/* Selfie analyzer */}
      <div className="bg-white border border-line rounded-2xl p-5 mb-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rose/30 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap gap-4 items-center justify-between">
          <div className="max-w-md">
            <div className="font-display text-xl font-semibold mb-1">
              Analyze your colors with AI
            </div>
            <p className="text-sm text-ink-soft">
              Upload a clear, well-lit photo of your face. ClosetCore identifies
              your skin/hair/eye tones, picks your best season, and customizes
              every season's palette to your complexion.
            </p>
          </div>
          <label className="px-5 py-3 rounded-full bg-gradient-to-r from-rose to-peach text-ink font-medium cursor-pointer hover:opacity-90 inline-flex items-center gap-2">
            <Sparkles size={16} />
            {aiBusy ? 'Analyzing…' : 'Upload selfie'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={aiBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyzeSelfie(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {aiErr && (
          <div className="text-sm text-red-700 mt-3 relative">{aiErr}</div>
        )}
        {palette?.rationale && (
          <div className="mt-4 text-sm bg-cream-2/60 rounded-lg p-3 relative">
            <span className="font-medium">Why this season: </span>
            <span className="text-ink-soft">{palette.rationale}</span>
          </div>
        )}
      </div>

      {/* Season cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {SEASONS.map((s) => {
          const meta = SEASON_PALETTES[s];
          const personalized = palette?.per_season_palettes?.[s];
          const swatchColors = personalized?.primary ?? meta.primary;
          const isBest = palette?.season === s;
          const isActiveView = view === s;
          return (
            <button
              key={s}
              disabled={busy || aiBusy}
              onClick={() => {
                if (palette?.per_season_palettes) {
                  // After AI analysis, the "best" badge is locked. Clicking
                  // your current best clears it; otherwise just changes view.
                  if (isBest) clearSeason();
                  else setView(s);
                } else if (isBest) {
                  // Manual mode: click your best again to unselect.
                  clearSeason();
                } else {
                  pickSeason(s);
                }
              }}
              className={`text-left bg-white border rounded-2xl p-5 lift transition relative ${
                isActiveView ? 'border-ink ring-2 ring-ink' : 'border-line'
              }`}
            >
              {isBest && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-rose/30 text-[10px] font-medium uppercase tracking-wider">
                  Your best
                </div>
              )}
              <div className="font-display text-xl font-semibold mb-3">
                {meta.label}
              </div>
              <div className="flex h-7 rounded overflow-hidden mb-3">
                {swatchColors.map((c, i) => (
                  <div key={`${c}-${i}`} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="text-xs text-ink-soft leading-relaxed">
                {personalized
                  ? 'Customized to your tones'
                  : meta.description}
              </div>
            </button>
          );
        })}
      </div>

      {detail ? (
        <div className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold mb-1">
            {view ? `Your ${SEASON_PALETTES[view].label} palette` : 'Your palette'}
          </h2>
          <p className="text-sm text-ink-soft mb-6">
            {palette?.per_season_palettes && view
              ? `Customized to your tones${palette.undertone ? ` · ${palette.undertone} undertone` : ''}.`
              : view
                ? SEASON_PALETTES[view].description
                : ''}
          </p>
          <Group label="Primary" colors={detail.primary} />
          <Group label="Secondary" colors={detail.secondary} />
          <Group label="Accents" colors={detail.accent} />
          <Group label="Neutrals" colors={detail.neutral} />
          <Group label="Avoid" colors={detail.avoid} />
        </div>
      ) : (
        <div className="border border-dashed border-line rounded-2xl p-12 text-center bg-white/40">
          <p className="text-ink-soft text-sm">
            Pick a season above or upload a selfie to generate your palette.
          </p>
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
  if (p.per_season_palettes?.[view]) {
    return p.per_season_palettes[view];
  }
  // No custom palettes yet; if we're viewing the user's "best" season,
  // surface the top-level palette stored on the row.
  if (p.season === view) {
    return {
      primary: p.primary_colors,
      secondary: p.secondary_colors,
      accent: p.accent_colors,
      neutral: p.neutral_colors,
      avoid: p.avoid_colors,
    };
  }
  // Otherwise fall back to the static seasonal palette.
  const meta = SEASON_PALETTES[view];
  return {
    primary: meta.primary,
    secondary: meta.secondary,
    accent: meta.accent,
    neutral: meta.neutral,
    avoid: meta.avoid,
  };
}

function Group({ label, colors }: { label: string; colors: string[] }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs uppercase tracking-widest text-ink-soft mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <div
            key={`${c}-${i}`}
            title={c}
            className="w-12 h-12 rounded-lg border border-line shadow-sm"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
