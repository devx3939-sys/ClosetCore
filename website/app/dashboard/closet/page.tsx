import { createClient } from '@/lib/supabase-server';
import type { ClosetItem } from '@shared/types';
import ClosetView from './ClosetView';

export const dynamic = 'force-dynamic';

export default async function ClosetPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('closet_items')
    .select('*')
    .order('created_at', { ascending: false });
  return <ClosetView initialItems={(data ?? []) as ClosetItem[]} />;
}
