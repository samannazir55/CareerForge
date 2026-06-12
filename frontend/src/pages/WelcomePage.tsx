import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export function WelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Smart Redirect: If user is already authenticated, send them straight to the app workspace
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleStart = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse"
        style={{
          animationDelay: '1s'
        }} />
      
      <div
        className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-pink-500/5 blur-[100px] animate-pulse"
        style={{
          animationDelay: '2s'
        }} />
      

      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.8,
          ease: 'easeOut'
        }}
        className="relative z-10 max-w-3xl w-full px-6 text-center">
        
        <motion.div
          initial={{
            scale: 0.9,
            opacity: 0
          }}
          animate={{
            scale: 1,
            opacity: 1
          }}
          transition={{
            delay: 0.2,
            duration: 0.5
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 mb-8 border-indigo-500/20 text-indigo-400 font-medium text-sm">
          
          <Sparkles size={16} />
          <span>AI-Powered Resume Builder</span>
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-zinc-100">
          Build your resume like <br className="hidden md:block" />
          <span className="text-gradient">talking to a friend.</span>
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          No more tedious forms. Chat with our intelligent career coach, and
          watch your professional, ATS-friendly resume build itself in
          real-time.
        </p>

        <motion.div
          whileHover={{
            scale: 1.02
          }}
          whileTap={{
            scale: 0.98
          }}>
          
          <Button
            size="lg"
            onClick={handleStart}
            className="group bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-lg px-8 py-6 rounded-2xl shadow-xl shadow-zinc-950/20 font-semibold border-none transition-all">
            
            Start building for free
            <ArrowRight
              className="ml-2 group-hover:translate-x-1 transition-transform"
              size={20} />
            
          </Button>
        </motion.div>

        {/* Feature list */}
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          transition={{
            delay: 0.6,
            duration: 0.8
          }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          {[
          {
            icon: <Sparkles className="text-purple-400" />,
            title: 'Conversational AI',
            desc: 'Answer simple questions naturally.'
          },
          {
            icon: <FileText className="text-indigo-400" />,
            title: 'Live Preview',
            desc: 'Watch your resume assemble instantly.'
          },
          {
            icon: <CheckCircle2 className="text-emerald-400" />,
            title: 'ATS-Optimized',
            desc: 'Formats that pass the screening bots.'
          }].
          map((feature, i) =>
          <div key={i} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 p-6 rounded-2xl shadow-lg">
              <div className="mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-zinc-100 mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-400">{feature.desc}</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>);
}