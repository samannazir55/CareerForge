import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, ArrowRight, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AuthCard = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
    <div className="absolute w-96 h-96 rounded-full bg-violet-500/15 -top-20 -left-20 blur-3xl pointer-events-none" />
    <div className="absolute w-80 h-80 rounded-full bg-purple-400/10 -bottom-10 -right-10 blur-3xl pointer-events-none" />
    <div className="relative z-10 w-full max-w-md">
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
          <Sparkles size={16} />
        </div>
        <span className="text-xl font-bold tracking-tight">CareerForge</span>
      </div>
      <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">{children}</div>
    </div>
  </div>
);

const InputField = ({ label, type = 'text', value, onChange, placeholder, autoComplete }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) => {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="relative">
        <input type={isPw && show ? 'text' : type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoComplete={autoComplete}
          className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-all" />
        {isPw && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
};

const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">{msg}</div>
);

const OTPVerify = ({ email, onSuccess }: { email: string; onSuccess: () => void }) => {
  const { verifyOTP, resendOTP } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[idx] = val; setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (val && idx === 5 && next.every(d => d)) handleVerify(next.join(''));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
      setTimeout(() => handleVerify(pasted), 100);
    }
  };

  const handleVerify = async (code?: string) => {
    const finalCode = code || otp.join('');
    if (finalCode.length < 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true); setError('');
    const result = await verifyOTP(email, finalCode);
    setLoading(false);
    if (result.success) { onSuccess(); }
    else { setError(result.error || 'Invalid code.'); setOtp(['', '', '', '', '', '']); inputRefs.current[0]?.focus(); }
  };

  const handleResend = async () => {
    setResendLoading(true); setResendMsg(''); setError('');
    const result = await resendOTP(email);
    setResendLoading(false);
    if (result.success) {
      setResendMsg('New code sent!'); setCountdown(60); setCanResend(false);
      setOtp(['', '', '', '', '', '']); inputRefs.current[0]?.focus();
    } else { setError(result.error || 'Could not resend.'); }
  };

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-4">
          <Mail size={24} />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We sent a 6-digit code to<br /><strong className="text-foreground">{email}</strong>
        </p>
      </div>

      {error && <ErrorBox msg={error} />}
      {resendMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle size={14} /> {resendMsg}
        </div>
      )}

      <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input key={i} ref={el => { inputRefs.current[i] = el; }}
            type="text" inputMode="numeric" maxLength={1} value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-11 h-14 rounded-xl border-2 text-center text-xl font-bold bg-card transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
              digit ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-border text-foreground'
            }`} />
        ))}
      </div>

      <button onClick={() => handleVerify()} disabled={loading || otp.join('').length < 6}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 mb-5 active:scale-[0.98] transition-transform">
        {loading ? 'Verifying…' : <><CheckCircle size={15} /> Verify Email</>}
      </button>

      <div className="text-center text-sm">
        {canResend ? (
          <button onClick={handleResend} disabled={resendLoading}
            className="flex items-center gap-1.5 mx-auto text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={resendLoading ? 'animate-spin' : ''} />
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>
        ) : (
          <span className="text-muted-foreground">Resend in <strong className="tabular-nums">{countdown}s</strong></span>
        )}
      </div>
    </AuthCard>
  );
};

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) { localStorage.setItem('cf_pending_email', email); navigate('/verify-otp'); }
    else setError(result.error || 'Registration failed.');
  };

  return (
    <AuthCard>
      <h1 className="text-2xl font-semibold text-center mb-1">Create your account</h1>
      <p className="text-sm text-muted-foreground text-center mb-7">Start building your career — it's free</p>
      {error && <ErrorBox msg={error} />}
      <form onSubmit={handleSubmit}>
        <InputField label="Full name" value={name} onChange={setName} placeholder="Alex Johnson" autoComplete="name" />
        <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="username" />
        <InputField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
        <button type="submit" disabled={loading}
          className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm active:scale-[0.98] transition-transform">
          {loading ? 'Creating account…' : <>Create account <ArrowRight size={15} /></>}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-5">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold underline underline-offset-2 text-indigo-500">Sign in</Link>
      </p>
    </AuthCard>
  );
};

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else if (result.needsVerification) { localStorage.setItem('cf_pending_email', email); navigate('/verify-otp'); }
    else setError(result.error || 'Login failed.');
  };

  return (
    <AuthCard>
      <h1 className="text-2xl font-semibold text-center mb-1">Welcome back</h1>
      <p className="text-sm text-muted-foreground text-center mb-7">Sign in to continue building your career</p>
      {error && <ErrorBox msg={error} />}
      <form onSubmit={handleSubmit}>
        <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="username" />
        <InputField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={loading}
          className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm active:scale-[0.98] transition-transform">
          {loading ? 'Signing in…' : <>Sign in <ArrowRight size={15} /></>}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-5">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold underline underline-offset-2 text-indigo-500">Create one free</Link>
      </p>
    </AuthCard>
  );
};

export const VerifyOTPPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = localStorage.getItem('cf_pending_email') || '';

  useEffect(() => {
    if (user) { localStorage.removeItem('cf_pending_email'); navigate('/dashboard', { replace: true }); }
  }, [user, navigate]);

  useEffect(() => {
    if (!email && !user) navigate('/register', { replace: true });
  }, [email, user, navigate]);

  const handleSuccess = () => {
    localStorage.removeItem('cf_pending_email');
    setTimeout(() => { window.location.href = '/dashboard'; }, 50);
  };

  return <OTPVerify email={email} onSuccess={handleSuccess} />;
};
