import { createClient } from '@/lib/supabase-server';
import type { Profile } from '@shared/types';
import ProfileView from './ProfileView';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle();

  const [{ count: itemCount }, { count: outfitCount }] = await Promise.all([
    supabase
      .from('closet_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id),
    supabase
      .from('outfits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id),
  ]);

  return (
    <ProfileView
      profile={(data ?? null) as Profile | null}
      email={user!.email ?? ''}
      stats={{ items: itemCount ?? 0, outfits: outfitCount ?? 0 }}
    />
  );
}
