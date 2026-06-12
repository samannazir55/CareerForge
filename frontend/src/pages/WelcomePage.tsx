import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Brain, Layers, Award, ArrowRight,
  Zap, Shield, Star
} from 'lucide-react';
import { Button } from '../components/ui/Button';

const FEATURES = [
  {
    icon: <Brain size={22} className="text-indigo-500" />,
    title: 'AI-Powered Writing',
    desc: 'Chat naturally with our AI. It collects your career info and builds a polished resume in real time.',
  },
  {
    icon: <Layers size={22} className="text-purple-500" />,
    title: 'Premium Templates',
    desc: 'Choose from 8+ professionally designed templates optimized for ATS systems.',
  },
  {
    icon: <Award size={22} className="text-amber-500" />,
    title: 'PDF & DOCX Export',
    desc: 'Download your finished resume as a pixel-perfect PDF or editable Word document instantly.',
  },
  {
    icon: <Zap size={22} className="text-emerald-500" />,
    title: 'Points Economy',
    desc: 'Earn points by completing your profile and unlock premium templates to stand out.',
  },
  {
    icon: <Shield size={22} className="text-blue-500" />,
    title: 'ATS Optimized',
    desc: 'All templates are tested against leading ATS scanners to maximize your interview rate.',
  },
  {
    icon: <Star size={22} className="text-rose-500" />,
    title: 'Upload & Enhance',
    desc: 'Already have a resume? Upload it and our AI will instantly improve and reformat it.',
  },
];

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-y-auto relative">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/3 -right-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute -bottom-32 left-1/3 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">CareerForge</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Sign In
          </Button>
          <Button variant="brand" size="sm" onClick={() => navigate('/register')}>
            Get Started Free
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-semibold mb-8">
            <Sparkles size={14} />
            AI Career Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
            Your career,{' '}
            <span className="text-gradient">forged by AI.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Chat with our AI career architect, build a stunning resume in minutes, and download it as a
            pixel-perfect PDF — completely free to start.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="brand"
              size="lg"
              onClick={() => navigate('/register')}
              className="shadow-2xl shadow-indigo-500/30 px-10"
            >
              Build My Resume Free
              <ArrowRight size={18} className="ml-2" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-sm text-muted-foreground mt-6">
            No credit card required · Free forever on Basic plan
          </p>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.4 }}
              className="glass-panel rounded-3xl p-6 hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
            >
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA footer */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-12 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="glass-panel rounded-3xl p-10 border-indigo-500/10"
        >
          <h2 className="text-3xl font-bold mb-3">Ready to land your dream job?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of professionals who've built their careers with CareerForge.
          </p>
          <Button variant="brand" size="lg" onClick={() => navigate('/register')} className="px-10">
            Start for Free <ArrowRight size={18} className="ml-2" />
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
