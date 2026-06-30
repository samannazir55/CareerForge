import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

const RESEND_COOLDOWN_SECONDS = 60; // mirrors apps/api OTP_RESEND_COOLDOWN_SECONDS default; purely cosmetic — the server enforces the real limit regardless of this countdown

export function VerifyOtpPage() {
  const { user, status, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (user?.isEmailVerified) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(code);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    try {
      await resendOtp();
      setInfo('A new code has been sent.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend code. Please try again shortly.');
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle={`We sent a 6-digit code to ${user?.email ?? 'your email'}.`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Verification code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, ''))}
          className="text-center text-lg tracking-[0.5em]"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full mt-2">
          {isSubmitting ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>

      <div className="text-center mt-6">
        <Button type="button" variant="ghost" size="sm" disabled={cooldown > 0} onClick={handleResend}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get a code? Resend"}
        </Button>
      </div>
    </AuthLayout>
  );
}
