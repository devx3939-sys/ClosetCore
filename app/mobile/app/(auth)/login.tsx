import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setInfo(null);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
    else if (mode === 'signup')
      setInfo('Account created. Check email to confirm, then sign in.');
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>ClosetCore</Text>
      <Text style={styles.muted}>
        {mode === 'signin'
          ? 'Sign in to sync across devices.'
          : 'Create an account.'}
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {err && <Text style={styles.error}>{err}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <TouchableOpacity style={styles.btnPrimary} disabled={busy} onPress={submit}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryText}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        <Text style={styles.link}>
          {mode === 'signin'
            ? "No account? Sign up"
            : 'Have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fafaf8' },
  brand: { fontSize: 36, fontWeight: '700', marginBottom: 4 },
  muted: { color: '#707070', marginBottom: 24 },
  label: { fontSize: 12, color: '#707070', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  error: { color: '#c0392b', marginTop: 12 },
  info: { color: '#285c33', marginTop: 12 },
  btnPrimary: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 16, color: '#444' },
});
