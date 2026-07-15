import { LegalPageLayout } from './LegalPageLayout';

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="July 2026">
      <p>
        This policy explains what information Corvyx ("we", "us") collects when you use corvyx.app (the
        "Service"), why we collect it, and who we share it with. It's written to describe what this product
        actually does, not generic boilerplate — but it is not a substitute for legal advice, and you should
        have it reviewed by a lawyer before relying on it, particularly regarding GDPR/CCPA compliance for
        your specific user base.
      </p>

      <h2>1. Information we collect</h2>
      <p><strong>Account information.</strong> Email address, full name, and a hashed password if you register
      directly. If you sign in with Google or GitHub instead, we receive your name, email, and profile
      information from that provider rather than storing a password ourselves.</p>
      <p><strong>Resume and career content.</strong> Anything you enter into the resume builder, career profile,
      or job tracker — work history, education, skills, job applications, notes, and any documents or photos you
      upload. This is the core content of the Service and is stored so you can access and edit it later.</p>
      <p><strong>Payment information.</strong> If you subscribe to a paid plan, payment is handled entirely by
      Stripe. We do not receive or store your card number — we receive limited transaction metadata (subscription
      status, plan tier) from Stripe to manage your account.</p>
      <p><strong>Usage and analytics data.</strong> We use Google Analytics to understand aggregate usage
      patterns (which pages are visited, general traffic sources). This does not include the contents of your
      resume or job applications.</p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide the Service — building, storing, and exporting your resume; tracking job applications</li>
        <li>To process AI-assisted features (resume chat, ATS scoring, job matching) — see Section 3</li>
        <li>To process payments and manage subscriptions</li>
        <li>To send account-related email (verification, password reset, receipts)</li>
        <li>To detect and prevent abuse, fraud, and security issues</li>
        <li>To understand aggregate product usage so we can improve it</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        Features like AI resume chat, ATS scoring, and job matching send relevant portions of your resume and,
        where applicable, a job description you provide to a third-party AI provider (our infrastructure
        currently supports Anthropic, OpenAI, and Groq, routed through OpenRouter) in order to generate a
        response. These providers process that content to return the result to you; we do not control their
        internal retention practices and you should review their own policies if you have concerns about a
        specific provider.
      </p>

      <h2>4. Who we share information with</h2>
      <p>We share information only with the service providers necessary to run Corvyx, each acting on our
      behalf under their own security obligations:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing and subscription billing</li>
        <li><strong>Google / GitHub</strong> — optional sign-in (only if you choose to use them)</li>
        <li><strong>Resend</strong> — transactional email (verification codes, password resets)</li>
        <li><strong>Cloudinary</strong> — storage for uploaded profile photos and images</li>
        <li><strong>Google Analytics</strong> — aggregate, anonymized usage analytics</li>
        <li><strong>Our AI providers</strong> (Anthropic / OpenAI / Groq via OpenRouter) — described in Section 3</li>
        <li><strong>Our hosting and database providers</strong> — infrastructure that stores and serves the
        Service; they do not access your data except as needed to operate that infrastructure</li>
      </ul>
      <p>We do not sell your personal information, and we do not share your resume content with advertisers.</p>

      <h2>5. Data retention</h2>
      <p>We retain your account and resume data for as long as your account is active. If you delete your
      account, we delete your personal data within a reasonable period, except where we're required to retain
      records (e.g. transaction records) for legal or accounting purposes.</p>

      <h2>6. Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct, export, or delete your
      personal data, and to object to certain processing. You can access and edit most of your data directly
      in your account settings, or contact us using the details below for anything else.</p>

      <h2>7. Security</h2>
      <p>We use industry-standard practices to protect your data, including encrypted connections (HTTPS),
      hashed passwords, and access controls on our infrastructure. No system is perfectly secure, and we can't
      guarantee absolute security of information transmitted to the Service.</p>

      <h2>8. Children's privacy</h2>
      <p>Corvyx is not directed at children under 16, and we do not knowingly collect personal information
      from them.</p>

      <h2>9. Changes to this policy</h2>
      <p>We may update this policy from time to time. We'll update the "Last updated" date above when we do;
      material changes will be communicated more prominently.</p>

      <h2>10. Contact us</h2>
      <p>
        Questions about this policy or your data:{' '}
        <a href="mailto:REPLACE_WITH_SUPPORT_EMAIL">REPLACE_WITH_SUPPORT_EMAIL</a>
        <br />
        REPLACE_WITH_BUSINESS_NAME_AND_ADDRESS
      </p>
    </LegalPageLayout>
  );
}
