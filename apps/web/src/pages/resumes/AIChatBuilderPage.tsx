import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ResumePreview } from '../../components/preview/ResumePreview';
import { aiApi, resumeApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Resume } from '@careerforge/schema';
import { buildDefaultSections, DEFAULT_THEME, CURRENT_SCHEMA_VERSION } from '@careerforge/schema';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm your CareerForge AI. Let's build your resume together. What's your full name?",
};

const EMPTY_RESUME: Resume = {
  id: 'preview',
  ownerId: '',
  title: 'Your Name',
  theme: DEFAULT_THEME,
  sections: buildDefaultSections(),
  schemaVersion: CURRENT_SCHEMA_VERSION,
  migrationVersion: CURRENT_SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function AIChatBuilderPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [previewResume, setPreviewResume] = useState<Resume>(EMPTY_RESUME);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load existing resume if resumeId provided
  useEffect(() => {
    if (!resumeId) return;
    resumeApi.get(resumeId).then(({ resume }) => {
      setPreviewResume(resume as unknown as Resume);
    }).catch(() => undefined);
  }, [resumeId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const result = await aiApi.chat(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        resumeId,
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);

      // Update live preview if AI returned a resume update
      if (result.resumeUpdate) {
        setPreviewResume((prev) => ({
          ...prev,
          ...(result.resumeUpdate.title ? { title: result.resumeUpdate.title } : {}),
          ...(result.resumeUpdate.sections ? { sections: result.resumeUpdate.sections } : {}),
        }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="flex flex-col w-full lg:w-[420px] border-r border-border shrink-0">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h2 className="font-semibold text-sm">AI Resume Builder</h2>
              <p className="text-xs text-muted-foreground">Chat to build your resume</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Type your answer…"
              disabled={isSending}
              className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/30 overflow-auto p-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Live Preview</p>
            <ResumePreview resume={previewResume} scale={0.55} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
