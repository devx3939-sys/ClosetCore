import { createClient } from '@/lib/supabase-server';
import type { Profile } from '@shared/types';
import SubscriptionView from './SubscriptionView';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle();

  return (
    <SubscriptionView
      profile={(data ?? null) as Profile | null}
      email={user!.email ?? ''}
    />
  );
}
