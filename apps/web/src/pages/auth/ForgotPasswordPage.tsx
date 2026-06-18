import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
    } finally {
      // Always show the same success state regardless of outcome — the API
      // intentionally never reveals whether the email exists, and the UI
      // shouldn't undo that by branching on success/failure here.
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-sm text-muted-foreground mb-6">
          If an account exists for <span className="text-foreground font-medium">{email}</span>, we've sent a
          password reset code.
        </p>
        <Button className="w-full" onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}>
          I have my code
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="We'll send a reset code to your email.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-6">
        <Link to="/login" className="text-foreground font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
