import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { MessageSquarePlus, Bug, Paperclip, X, CheckCircle2, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { contactApi, ApiError, type ContactSubmissionType } from '../../lib/api';
import { cn } from '../../lib/utils';

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';

const TABS: { id: ContactSubmissionType; label: string; icon: typeof MessageSquarePlus; blurb: string; subjectPlaceholder: string; messagePlaceholder: string }[] = [
  {
    id: 'SUGGESTION',
    label: 'Suggestion',
    icon: MessageSquarePlus,
    blurb: "Have an idea that would make Corvyx better? We read every one of these.",
    subjectPlaceholder: 'A short summary of your idea',
    messagePlaceholder: "What would you like to see, and why would it help?",
  },
  {
    id: 'BUG_REPORT',
    label: 'Report a bug',
    icon: Bug,
    blurb: 'Something broken — a template, an export, a page that won\'t load? Tell us what happened, and attach a screenshot if you can.',
    subjectPlaceholder: 'e.g. "Export to PDF fails on the Modern template"',
    messagePlaceholder: 'What were you doing when it happened? What did you expect, and what happened instead?',
  },
];

/**
 * In-app Contact Us — two tabs (Suggestion / Bug Report) sharing one form
 * shape and one backend endpoint (POST /api/contact, see
 * domain/contact/contact.routes.ts). Optional screenshot attachment,
 * uploaded to Cloudinary server-side and stored alongside the submission;
 * an admin notification email goes out to CONTACT_INBOX_EMAIL the moment
 * it's saved.
 */
export function ContactPage() {
  const [activeTab, setActiveTab] = useState<ContactSubmissionType>('SUGGESTION');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tab = TABS.find((t) => t.id === activeTab)!;

  function switchTab(id: ContactSubmissionType) {
    setActiveTab(id);
    setError(null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Screenshots must be a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError('Screenshot is too large (max 10MB).');
      return;
    }
    setError(null);
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  function removeScreenshot() {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setSubject('');
    setMessage('');
    removeScreenshot();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both the subject and message.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await contactApi.submit({ type: activeTab, subject: subject.trim(), message: message.trim(), screenshot });
      resetForm();
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contact us</h1>
          <p className="text-muted-foreground mt-1">
            Suggest something, or let us know if something's broken — we read everything that comes through here.
          </p>
        </div>

        <div className="flex gap-2 bg-muted/50 p-1 rounded-xl border border-border/50 w-full sm:w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={cn(
                  'flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-background text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        <GlassCard>
          {submitted ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold mb-1">Thanks — that's on its way</h2>
              <p className="text-sm text-muted-foreground mb-6">
                We've received your {tab.label.toLowerCase()}. If it needs a reply, we'll reach out at your account email.
              </p>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Send another
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-muted-foreground -mt-1">{tab.blurb}</p>

              <Input
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={tab.subjectPlaceholder}
                maxLength={200}
                disabled={submitting}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={tab.messagePlaceholder}
                  rows={6}
                  maxLength={5000}
                  disabled={submitting}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Screenshot <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                {!screenshotPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                  >
                    <Paperclip size={15} /> Attach an image
                  </button>
                ) : (
                  <div className="relative w-fit">
                    <img src={screenshotPreview} alt="Screenshot preview" className="max-h-48 rounded-xl border border-border object-contain" />
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      aria-label="Remove screenshot"
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1.5" /> Sending…
                  </>
                ) : (
                  `Send ${tab.label.toLowerCase()}`
                )}
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}
