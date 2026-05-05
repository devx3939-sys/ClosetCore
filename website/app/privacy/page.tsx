import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="April 28, 2026">
      <p>
        This is a placeholder privacy policy for ClosetCore. Replace it
        with the actual policy reviewed by your legal counsel before launching
        publicly.
      </p>

      <h2>What we collect</h2>
      <p>
        Account data (email, hashed password) and the closet data you create:
        item photos, item metadata, outfits, and your color palette selection.
        That's it.
      </p>

      <h2>How we store it</h2>
      <p>
        Your account and closet data are stored in Supabase (Postgres + S3-style
        object storage). Every row is protected by row-level security: only
        your authenticated session can read or modify your data.
      </p>

      <h2>What we don't do</h2>
      <p>
        We don't sell your data. We don't run ad targeting against your closet.
        We don't share your wardrobe with third parties.
      </p>

      <h2>Your rights</h2>
      <p>
        You can export every item, outfit, and palette as JSON from your
        account settings. You can delete your account at any time, which
        removes all associated data within 30 days.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Reach us at privacy@closetcore.app.
      </p>
    </LegalShell>
  );
}
