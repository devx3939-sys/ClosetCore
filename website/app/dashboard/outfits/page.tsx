import { createClient } from '@/lib/supabase-server';
import type { ClosetItem, ColorPalette, Outfit } from '@shared/types';
import OutfitsView from './OutfitsView';

export const dynamic = 'force-dynamic';

export default async function OutfitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [o, i, p] = await Promise.all([
    supabase.from('outfits').select('*').order('created_at', { ascending: false }),
    supabase.from('closet_items').select('*').order('name'),
    user
      ? supabase
          .from('color_palettes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return (
    <OutfitsView
      initialOutfits={(o.data ?? []) as Outfit[]}
      items={(i.data ?? []) as ClosetItem[]}
      palette={(p.data ?? null) as ColorPalette | null}
    />
  );
}
