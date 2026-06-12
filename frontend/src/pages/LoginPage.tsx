import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Dynamic Background Blobs matching the Welcome page */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-500/10 blur-[130px] animate-pulse" />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-500/10 blur-[130px] animate-pulse" 
        style={{ animationDelay: '1s' }} 
      />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md px-6 text-center"
      >
        {/* Glowing Brand Icon */}
        <div className="flex flex-col items-center justify-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles size={22} className="text-white animate-pulse" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-zinc-100">CareerForge</span>
        </div>

        {/* Premium Frosted Glass Card */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 md:p-10 shadow-2xl shadow-black/50 text-left">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Welcome back</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Sign in to continue building your career.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20 leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input field wrapper for active state styling */}
            <div className="relative group">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 bg-zinc-950/60 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-xl transition-all"
                required
              />
            </div>

            <div className="relative group">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 bg-zinc-950/60 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-xl transition-all"
                required
              />
            </div>

            {/* Click & Hover Animated Button */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Button
                type="submit"
                variant="brand"
                size="lg"
                isLoading={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white font-medium rounded-xl h-12 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 border-none transition-opacity"
              >
                Sign In
                <ArrowRight size={18} />
              </Button>
            </motion.div>
          </form>

          <p className="text-center mt-6 text-sm text-zinc-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}