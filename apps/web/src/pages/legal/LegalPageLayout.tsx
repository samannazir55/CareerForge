import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared chrome for /privacy, /terms, /refund-policy. Deliberately plain —
 * no auth required, no AppShell nav — since these need to be readable and
 * linkable by anyone (including Stripe's own review process) whether or
 * not they have an account.
 */
export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-semibold text-lg">
            <span className="text-gradient">Corvyx</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>
        <div className="prose-legal space-y-6 text-sm leading-relaxed text-foreground/90">{children}</div>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/refund-policy" className="hover:text-foreground">Refunds</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} Corvyx</p>
      </footer>
    </div>
  );
}
