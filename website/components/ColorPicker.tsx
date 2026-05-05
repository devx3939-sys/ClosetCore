'use client';

import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';

const PRESETS = [
  '#000000', '#3a3a3d', '#707070', '#b8b8b3', '#faf7f2', '#ffffff',
  '#1d2b3a', '#0f3057', '#1f4c8e', '#3a82c6', '#a8c5d6',
  '#5a6f4d', '#779b5a', '#b5cba5', '#dde7c4',
  '#4a2e1c', '#8b5a3b', '#a0522d', '#b48868', '#d4ad81',
  '#5a1f1f', '#8b1a1a', '#c0392b', '#e8b4b8', '#fad2e1',
  '#3d1f5a', '#6b3fa0', '#9d8aaa', '#d6b5db',
  '#d4a017', '#e9c46a', '#ffd27d', '#ffe5a8',
];

export default function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 border border-line rounded-lg px-3 py-2 bg-white hover:bg-cream-2 transition"
      >
        <span
          className="w-8 h-8 rounded-md border border-line shadow-inner"
          style={{ background: color }}
        />
        <span className="font-mono text-sm flex-1 text-left">{color.toUpperCase()}</span>
        <span className="text-xs text-ink-soft">{open ? 'Close' : 'Pick'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 bg-white border border-line rounded-2xl p-4 shadow-2xl w-72">
          <HexColorPicker
            color={color}
            onChange={onChange}
            style={{ width: '100%', height: 180 }}
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-ink-soft">Hex</span>
            <HexColorInput
              color={color}
              onChange={onChange}
              prefixed
              className="border border-line rounded-md px-2 py-1 text-sm font-mono w-full"
            />
          </div>
          <div className="mt-3">
            <div className="text-xs text-ink-soft mb-1.5">Quick picks</div>
            <div className="grid grid-cols-9 gap-1">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`aspect-square rounded border ${
                    color.toLowerCase() === c.toLowerCase()
                      ? 'border-ink ring-2 ring-ink'
                      : 'border-line'
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
