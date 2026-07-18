import { LegalPageLayout } from './LegalPageLayout';

export function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="July 2026">
      <p>
        This policy covers refunds and cancellations for Corvyx paid subscriptions (Professional, Premium),
        billed through Stripe.
      </p>

      <h2>1. Cancelling your subscription</h2>
      <p>You can cancel anytime from Settings → Billing → Manage billing. Cancelling stops future billing
      immediately — you keep access to your paid plan's features until the end of the billing period you've
      already paid for, then your account moves to the Free plan. Your resume and job application data is not
      deleted when you downgrade.</p>

      <h2>2. Refunds</h2>
      <p>
        If you're not satisfied within your <strong>first 7 days</strong> of a paid subscription, contact us
        for a full refund of that initial payment — no questions asked. Outside that window, subscription
        payments are non-refundable for the current billing period, but cancelling still stops all future
        charges as described above.
      </p>
      <p>
        We may make exceptions at our discretion — for example, a billing error on our part, a duplicate
        charge, or a technical issue that prevented you from meaningfully using the Service. Contact us and
        we'll take a look.
      </p>

      <h2>3. How refunds are issued</h2>
      <p>Approved refunds are returned to your original payment method via Stripe, typically within 5-10
      business days depending on your bank.</p>

      <h2>4. Disputes and chargebacks</h2>
      <p>If you have a billing concern, please contact us directly before filing a chargeback with your bank
      — we can usually resolve it faster, and it helps keep the Service running smoothly for everyone.</p>

      <h2>5. Contact us</h2>
      <p>
        For refund requests or billing questions:{' '}
        <a href="mailto:connect@corvyx.app">connect@corvyx.app</a>
      </p>
    </LegalPageLayout>
  );
}
