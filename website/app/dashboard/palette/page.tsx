import { createClient } from '@/lib/supabase-server';
import type { ColorPalette } from '@shared/types';
import PaletteView from './PaletteView';

export const dynamic = 'force-dynamic';

export default async function PalettePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('color_palettes')
    .select('*')
    .eq('user_id', user!.id)
    .maybeSingle();
  return <PaletteView initial={(data as ColorPalette | null) ?? null} />;
}
