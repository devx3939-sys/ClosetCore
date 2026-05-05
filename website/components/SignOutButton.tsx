'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm"
    >
      Sign out
    </button>
  );
}
