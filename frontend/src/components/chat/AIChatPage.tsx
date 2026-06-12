import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Sparkles, Bot, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { aiApi } from '../../services/api';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// Import your existing preview component
import { CVPreview } from '../editor/CVPreview';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TypingDot {
  delay: number;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 p-4 bg-muted/50 rounded-2xl rounded-tl-sm w-fit">
      {([0, 1, 2] as TypingDot['delay'][]).map((delay) => (
        <motion.div
          key={delay}
          className="w-2 h-2 bg-foreground/40 rounded-full"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: delay * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

interface ChatBubbleProps {
  message: Message;
}

function ChatBubble({ message }: ChatBubbleProps) {
  const isAI = message.role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'flex gap-3 max-w-[85%]',
        isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1',
          isAI
            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
            : 'bg-primary text-primary-foreground'
        )}
      >
        {isAI ? <Bot size={16} /> : <User size={16} />}
      </div>
      <div
        className={cn(
          'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
          isAI
            ? 'bg-card border border-border rounded-tl-sm text-foreground'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        {message.content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line || <br />}
            {i < message.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

interface AIChatPageProps {
  onResumeGenerated: (data: Record<string, unknown>) => void;
  onNavigateToEditor: () => void;
}

export function AIChatPage({ onResumeGenerated, onNavigateToEditor }: AIChatPageProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedCVText, setUploadedCVText] = useState('');
  const [resumeGenerated, setResumeGenerated] = useState(false);
  
  // Dynamic preview state
  const [currentCVData, setCurrentCVData] = useState<Partial<CVData> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Greeting on mount
  useEffect(() => {
    const firstName = user?.fullName?.split(' ')[0] || 'there';
    const greeting = `Hi ${firstName}! I'm your AI Career Architect. 🧠\n\nI can write a resume from scratch, OR you can click 📎 to upload an existing CV for me to enhance!\n\nFirst — what's your target **Job Title**?`;
    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      },
    ]);
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMessage = (role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, content, timestamp: new Date() },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;
    setInputText('');
    addMessage('user', text);
    setIsTyping(true);

    try {
      // Build API history
      const apiHistory = messages.slice(-12).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      if (uploadedCVText) {
        apiHistory.unshift({
          role: 'system' as const,
          content: `User uploaded their CV:\n${uploadedCVText}`,
        });
      }

      const response = await aiApi.chat(apiHistory, text);
      setIsTyping(false);

      addMessage('assistant', response.reply);

      if (response.action === 'generate' && response.cv_data) {
        const cvData = response.cv_data;
        setCurrentCVData(cvData as Partial<CVData>); // Instantly load into Live Preview!
        onResumeGenerated(cvData as Record<string, unknown>);
        setResumeGenerated(true);
        setTimeout(() => onNavigateToEditor(), 2000);
      }
    } catch {
      setIsTyping(false);
      addMessage('assistant', '❌ Connection error. Please check your connection and try again.');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addMessage('user', `📎 Uploaded: ${file.name}`);
    setIsTyping(true);

    try {
      const res = await aiApi.uploadResume(file);
      const extracted = res.extracted_text || '';
      setUploadedCVText(extracted.substring(0, 3000));

      const apiHistory = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const contextMessage = `I just uploaded my CV. Please analyze it and tell me what you found. Here's the content:\n\n${extracted.substring(0, 2000)}`;
      const response = await aiApi.chat(apiHistory, contextMessage);

      setIsTyping(false);
      addMessage('assistant', response.reply);

      if (response.action === 'generate' && response.cv_data) {
        setCurrentCVData(response.cv_data as Partial<CVData>); // Instantly load into Live Preview!
        onResumeGenerated(response.cv_data as Record<string, unknown>);
        setResumeGenerated(true);
        setTimeout(() => onNavigateToEditor(), 2000);
      }
    } catch {
      setIsTyping(false);
      addMessage('assistant', '❌ Upload failed. Please try a different file.');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Dynamic Quick Replies Helper ---
  const getLastAssistantMessage = () => {
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    return assistantMessages[assistantMessages.length - 1]?.content || '';
  };

  const getQuickReplies = () => {
    const lastMsg = getLastAssistantMessage().toLowerCase();

    if (lastMsg.includes('job title') || lastMsg.includes("target")) {
      return [
        'Software Engineer',
        'Product Manager',
        'Data Analyst',
        'Digital Marketer',
      ];
    }

    if (lastMsg.includes('skills')) {
      return [
        'React, TypeScript, Node.js, Tailwind CSS',
        'Figma, User Research, Prototyping, UI/UX',
        'Python, SQL, Data Analysis, PowerBI',
        'SEO, Content Writing, Google Analytics',
      ];
    }

    if (lastMsg.includes('experience level') || lastMsg.includes('years of experience')) {
      return [
        'Entry Level (0-1 years)',
        'Mid-Level (2-4 years)',
        'Senior Level (5+ years)',
        'Lead / Manager',
      ];
    }

    return null;
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row overflow-hidden bg-background">
      
      {/* LEFT COLUMN: The AI Chat Panel (35% Width) */}
      <div className="w-full md:w-[40%] lg:w-[35%] h-full flex flex-col border-r border-border/50 relative overflow-hidden bg-background/50 backdrop-blur-xl">
        {/* Background gradient blur */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-ai opacity-50 pointer-events-none" />

        {/* Header */}
        <div className="flex-none p-5 border-b border-border/50 glass-panel z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base">AI Career Architect</h2>
              <p className="text-xs text-muted-foreground">Powered by OpenRouter</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 hide-scrollbar z-10">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex gap-3 max-w-[85%]"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 flex items-center justify-center mt-1">
                  <Sparkles size={14} />
                </div>
                <TypingIndicator />
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA when resume is generated */}
          {resumeGenerated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-2xl p-4 border border-indigo-500/20 bg-indigo-500/5"
            >
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-3">
                ✅ Resume generated! Opening editor...
              </p>
              <Button variant="brand" size="sm" onClick={onNavigateToEditor}>
                Open Editor <ArrowRight size={14} className="ml-1" />
              </Button>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area & Quick Reply Chips */}
        <div className="flex-none p-5 glass-panel border-t border-border/50 z-10">
          
          {/* FLOATING QUICK REPLY CHIPS */}
          {!isTyping && getQuickReplies() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {getQuickReplies()?.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(reply)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all text-left line-clamp-1 max-w-full shadow-sm cursor-pointer"
                >
                  {reply}
                </button>
              ))}
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            {/* File upload */}
            <label
              className="flex-none w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center cursor-pointer hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Upload resume (PDF/DOCX)"
            >
              <Paperclip size={18} />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx"
                onChange={handleUpload}
              />
            </label>

            {/* Text input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your reply..."
              disabled={isTyping}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-50 text-sm"
            />

            {/* Send button */}
            <Button
              variant="brand"
              size="icon"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isTyping}
              className="flex-none"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Interactive Preview (Hidden on mobile, flex-1 on desktop) */}
      <div className="hidden md:flex md:flex-1 h-full items-start justify-center p-8 overflow-y-auto bg-muted/30 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px]">
        <div className="w-full max-w-4xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden p-6 scale-90 lg:scale-100 origin-top transition-transform">
          <CVPreview data={currentCVData || DEFAULT_CV_DATA} templateId="modern" />
        </div>
      </div>

    </div>
  );
}

// ============================================================
// CAREERFORGE — UNIFIED TYPE DEFINITIONS
// ============================================================

// ------ Auth & User ------

export type SubscriptionPlan = 'basic' | 'professional' | 'premium';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  fullName: string | null; 
  is_active: boolean;
  subscription_plan: SubscriptionPlan;
  credits?: number;
}

// ------ CV / Resume Data ------

export interface CVData {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  summary: string;
  experience: string;
  education: string;
  skills: string; 

  location: string;
  hobbies: string;
  languages: string;
  certifications: string;

  linkedin: string;
  github: string;
  portfolio: string;

  accentColor: string;
  textColor: string;
  fontFamily: string;
  profileImage?: string;
}

export const DEFAULT_CV_DATA: CVData = {
  fullName: '',
  email: '',
  phone: '',
  jobTitle: '',
  summary: '',
  experience: '',
  education: '',
  skills: '',
  location: '',
  hobbies: '',
  languages: '',
  certifications: '',
  linkedin: '',
  github: '',
  portfolio: '',
  accentColor: '#2c3e50',
  textColor: '#333333',
  fontFamily: 'Helvetica, Arial, sans-serif',
};

export interface CVRecord {
  id: number;
  user_id: number;
  title: string;
  template_id: string;
  data: CVData;
  created_at: string;
  updated_at: string;
}

// ------ Templates ------

export interface BackendTemplate {
  id: string;
  name: string;
  category: string;
  is_premium: boolean;
  html_content?: string;
  css_styles?: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  category: string;
  cost: number;          
  atsScore: number;
  popularity: number;    
  description: string;
  isPremium: boolean;
  colorTheme?: string;
}

// ------ Chat / AI ------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIResponse {
  reply: string;
  action: 'chat' | 'generate';
  cv_data?: Partial<CVData>;
}

// ------ Points & Transactions ------

export type TransactionType = 'earn' | 'spend';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  label: string;
  date: Date;
}

// ------ API ------

export interface ApiError {
  detail: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}