import { LegalPageLayout } from './LegalPageLayout';

export function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="July 2026">
      <p>
        These terms govern your use of corvyx.app (the "Service"), operated by
        REPLACE_WITH_BUSINESS_NAME ("we", "us"). By creating an account or using the Service, you agree to
        these terms. This is standard-form drafting, not a substitute for legal review specific to your
        business and jurisdiction.
      </p>

      <h2>1. What Corvyx is</h2>
      <p>Corvyx is a career platform that helps you build resumes, track job applications, and use
      AI-assisted tools to tailor and evaluate your resume against job descriptions.</p>

      <h2>2. Your account</h2>
      <p>You must provide accurate information when creating an account and keep your login credentials
      secure. You're responsible for activity that happens under your account. You must be at least 16 years
      old to use the Service.</p>

      <h2>3. Subscriptions and billing</h2>
      <ul>
        <li>Paid plans (Professional, Premium) are billed monthly in advance through Stripe.</li>
        <li>Subscriptions renew automatically each billing period until you cancel.</li>
        <li>You can cancel anytime from Settings → Billing → Manage billing. Cancellation stops future
        billing; it does not retroactively refund the current billing period except as described in our{' '}
        <a href="/refund-policy">Refund Policy</a>.</li>
        <li>We may change subscription prices with reasonable advance notice; continued use after a price
        change takes effect constitutes acceptance of the new price.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose, or to submit false or fraudulent information</li>
        <li>Attempt to gain unauthorized access to other users' accounts or data</li>
        <li>Interfere with or disrupt the Service, including through automated scraping or excessive load</li>
        <li>Reverse-engineer, resell, or white-label the Service without our written permission</li>
        <li>Use the AI features to generate content that is illegal, deceptive, or infringes others' rights</li>
      </ul>
      <p>We may suspend or terminate accounts that violate these terms.</p>

      <h2>5. Your content</h2>
      <p>You retain ownership of the resume content, career information, and any other material you submit
      to Corvyx. You grant us a limited license to store, process, and display that content solely for the
      purpose of providing the Service to you — including sending it to AI providers as described in our{' '}
      <a href="/privacy">Privacy Policy</a> when you use AI-assisted features.</p>

      <h2>6. AI-generated content</h2>
      <p>Features like the AI resume chat, ATS scoring, and job-match suggestions use third-party AI models
      and are provided for guidance only. AI output can be inaccurate or unsuitable for your specific
      situation — you're responsible for reviewing and verifying any AI-generated content before relying on
      it, including for a real job application.</p>

      <h2>7. Intellectual property</h2>
      <p>The Service itself — including its design, code, templates, and branding — is owned by us or our
      licensors and is protected by intellectual property law. These terms don't grant you any rights to our
      trademarks or branding beyond what's needed to use the Service normally.</p>

      <h2>8. Disclaimers</h2>
      <p>The Service is provided "as is" without warranties of any kind, express or implied. We don't
      guarantee that using Corvyx will result in job offers, interviews, or any particular career outcome.</p>

      <h2>9. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential
      damages arising from your use of the Service. Our total liability for any claim relating to the Service
      is limited to the amount you paid us in the 12 months preceding the claim.</p>

      <h2>10. Termination</h2>
      <p>You may stop using the Service and delete your account at any time from Settings. We may suspend or
      terminate your access if you violate these terms, with notice where practical.</p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these terms from time to time. Continued use of the Service after changes take effect
      constitutes acceptance of the updated terms.</p>

      <h2>12. Governing law</h2>
      <p>These terms are governed by the laws of REPLACE_WITH_JURISDICTION, without regard to conflict-of-law
      principles.</p>

      <h2>13. Contact us</h2>
      <p>
        Questions about these terms:{' '}
        <a href="mailto:connect@corvyx.app">connect@corvyx.app</a>
      </p>
    </LegalPageLayout>
  );
}
