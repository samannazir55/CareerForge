// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  fullName?: string;
  is_active: boolean;
  is_email_verified: boolean;
  subscription_plan: 'basic' | 'professional' | 'premium';
  credits?: number;
  unlocked_templates?: string;   // comma-separated template IDs
}

// ─── CV / Resume ─────────────────────────────────────────────────────────────
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
  fullName: '', email: '', phone: '', jobTitle: '',
  summary: '', experience: '', education: '', skills: '',
  location: '', hobbies: '', languages: '', certifications: '',
  linkedin: '', github: '', portfolio: '',
  accentColor: '#6D5FFA', textColor: '#333333',
  fontFamily: 'Inter, sans-serif',
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

// ─── Templates ───────────────────────────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  category: string;
  is_premium: boolean;
  html_content?: string;
  css_styles?: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────
export type SubscriptionPlan = 'basic' | 'professional' | 'premium';

export const PLAN_CONFIG: Record<SubscriptionPlan, {
  label: string;
  price: string;
  features: string[];
  color: string;
}> = {
  basic: {
    label: 'Basic',
    price: 'Free',
    features: ['2 free templates', 'AI chat onboarding', 'PDF export', '3 resumes max'],
    color: 'text-muted-foreground',
  },
  professional: {
    label: 'Professional',
    price: '$12/mo',
    features: ['All standard templates', 'Unlimited resumes', 'DOCX export', 'ATS scan', 'Priority support'],
    color: 'text-violet-500',
  },
  premium: {
    label: 'Premium',
    price: '$29/mo',
    features: ['Every template free', 'Cover letter AI', 'LinkedIn optimizer', 'White-glove review', 'Interview prep'],
    color: 'text-amber-500',
  },
};

// ─── Navigation ──────────────────────────────────────────────────────────────
export type AppView = 'landing' | 'chat' | 'editor' | 'marketplace' | 'dashboard';
