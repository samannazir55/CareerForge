import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { LogoMark } from '../components/ui/LogoMark';

/**
 * Catch-all for any route that doesn't match — wired as
 * `<Route path="*" element={<NotFoundPage />} />` at the bottom of App.tsx's
 * route list, so it only renders once every other, more specific route has
 * already failed to match.
 *
 * Uses the same dark/neon treatment as WelcomePage (the app's other
 * "renders regardless of auth state" page) rather than the light
 * glassmorphism look the signed-in app pages use — a 404 is just as likely
 * to be hit by a logged-out visitor following a dead link as by a signed-in
 * user with a stale bookmark, so it shouldn't assume either look.
 */
export function NotFoundPage() {
  const { user } = useAuth();
  const homeHref = user ? '/dashboard' : '/';

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center text-white overflow-hidden relative"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99, 102, 241, 0.25), transparent), #06060c',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <LogoMark size={40} className="text-indigo-400 mb-8" />

        <h1 className="text-[7rem] sm:text-[9rem] font-bold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
          404
        </h1>

        <p className="text-xl sm:text-2xl font-semibold mt-2 mb-2">This page doesn't exist</p>
        <p className="text-white/50 max-w-md mb-8">
          The link might be broken, or the page may have moved. Let's get you back on track.
        </p>

        <Link to={homeHref}>
          <Button size="lg" className="bg-white text-black hover:bg-white/90">
            <Compass size={18} className="mr-1.5" />
            {user ? 'Back to Dashboard' : 'Back to Corvyx'}
            <ArrowRight size={18} className="ml-1.5" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
