import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(email, code, newPassword);
      navigate('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the code we emailed you and choose a new password.">
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
        <Input
          label="Reset code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full mt-2">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
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
