// ============================================================
// CAREERFORGE — UNIFIED TYPE DEFINITIONS
// ============================================================

// ------ Auth & User ------

export type SubscriptionPlan = 'basic' | 'professional' | 'premium';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  fullName: string | null; // camelCase alias
  is_active: boolean;
  subscription_plan: SubscriptionPlan;
  credits?: number;
}

// ------ CV / Resume Data ------

export interface CVData {
  // Core fields (synced with backend schema)
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  summary: string;
  experience: string;
  education: string;
  skills: string; // comma-separated string for form; array on backend

  // Extended fields
  location: string;
  hobbies: string;
  languages: string;
  certifications: string;

  // Social links
  linkedin: string;
  github: string;
  portfolio: string;

  // Appearance
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

// Frontend template definition for Marketplace UI
export interface TemplateDef {
  id: string;
  name: string;
  category: string;
  cost: number;          // points cost (0 = free)
  atsScore: number;
  popularity: number;    // 1-100
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
