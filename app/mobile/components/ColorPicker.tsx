import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

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
  const [hex, setHex] = useState(color);

  function commitHex(v: string) {
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          setHex(color);
          setOpen((o) => !o);
        }}
      >
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <Text style={styles.hex}>{color.toUpperCase()}</Text>
        <Text style={styles.toggle}>{open ? 'Close' : 'Pick'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <Text style={styles.muted}>Hex</Text>
          <TextInput
            value={hex}
            onChangeText={commitHex}
            autoCapitalize="none"
            style={styles.input}
            maxLength={7}
          />
          <Text style={[styles.muted, { marginTop: 8 }]}>Quick picks</Text>
          <View style={styles.grid}>
            {PRESETS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  onChange(c);
                  setHex(c);
                }}
                style={[
                  styles.preset,
                  { backgroundColor: c },
                  color.toLowerCase() === c.toLowerCase() && styles.presetActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
  hex: { flex: 1, fontFamily: 'Menlo', fontSize: 13 },
  toggle: { fontSize: 12, color: '#707070' },
  muted: { color: '#707070', fontSize: 12 },
  panel: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 12,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'Menlo',
    fontSize: 13,
    marginTop: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  preset: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
  presetActive: { borderColor: '#1a1a1a', borderWidth: 2 },
});
