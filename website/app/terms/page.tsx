import LegalShell from '@/components/LegalShell';

export const metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="April 28, 2026">
      <p>
        This is a placeholder terms-of-service document for ClosetCore.
        Replace with the actual document reviewed by your legal counsel before
        launching publicly.
      </p>

      <h2>Acceptable use</h2>
      <p>
        ClosetCore is for personal wardrobe management. Don't upload illegal
        content, abuse other users (if/when social features ship), or attempt
        to disrupt the service.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of every photo and item you upload. By uploading,
        you grant ClosetCore a limited license to store and serve that content
        back to you across your devices.
      </p>

      <h2>Subscriptions</h2>
      <p>
        Pro subscriptions are billed monthly at $4.99 and renew until canceled.
        Cancel anytime in your account settings; cancellation takes effect at
        the end of the current billing period and you keep Pro access until
        then.
      </p>

      <h2>Service availability</h2>
      <p>
        ClosetCore aims for 99.9% uptime, but we don't guarantee uninterrupted
        service. Scheduled maintenance windows are announced in advance.
      </p>

      <h2>Liability</h2>
      <p>
        ClosetCore is provided as-is. We're not liable for any loss arising from
        use of the service, beyond the amount you've paid us in the prior 12
        months.
      </p>
    </LegalShell>
  );
}
