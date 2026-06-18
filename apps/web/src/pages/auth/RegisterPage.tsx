import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { OAuthButtons } from './OAuthButtons';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ fullName, email, password });
      navigate('/verify-otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Build a resume that gets you the interview.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <OAuthButtons />

      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-foreground font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
