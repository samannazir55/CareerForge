export interface TemplateDef {
    id: string;
    name: string;
    category: string;
    cost: number;
    atsScore: number;
    popularity: number; // 1-100
    description: string;
    baseComponent: 'classic' | 'modern';
    colorTheme?: string;
  }
  
  export const TEMPLATES: TemplateDef[] = [
    {
      id: 'modern',
      name: 'Modern Resume',
      category: 'General',
      cost: 0,
      atsScore: 85,
      popularity: 92,
      description: 'A clean, two-column layout perfect for most professionals.',
      baseComponent: 'modern'
    },
    {
      id: 'classic',
      name: 'Classic Resume',
      category: 'General',
      cost: 0,
      atsScore: 95,
      popularity: 88,
      description: 'Traditional, highly ATS-optimized single column layout.',
      baseComponent: 'classic'
    },
    {
      id: 'executive-pro',
      name: 'Executive Pro',
      category: 'Leadership',
      cost: 50,
      atsScore: 98,
      popularity: 95,
      description: 'Authoritative design for senior leadership and C-suite roles.',
      baseComponent: 'classic'
    },
    {
      id: 'silicon-valley',
      name: 'Silicon Valley',
      category: 'Tech',
      cost: 75,
      atsScore: 92,
      popularity: 98,
      description: 'The standard for top-tier tech companies and startups.',
      baseComponent: 'modern',
      colorTheme: 'blue'
    },
    {
      id: 'minimal-elite',
      name: 'Minimal Elite',
      category: 'Creative',
      cost: 60,
      atsScore: 88,
      popularity: 85,
      description: 'Ultra-clean, whitespace-heavy design for modern creatives.',
      baseComponent: 'modern',
      colorTheme: 'slate'
    },
    {
      id: 'creative-designer',
      name: 'Creative Designer',
      category: 'Creative',
      cost: 65,
      atsScore: 80,
      popularity: 89,
      description: 'Stand out with bold typography and unique structural elements.',
      baseComponent: 'modern',
      colorTheme: 'pink'
    },
    {
      id: 'academic-researcher',
      name: 'Academic Researcher',
      category: 'Academic',
      cost: 60,
      atsScore: 99,
      popularity: 75,
      description: 'Optimized for long-form CVs, publications, and academic history.',
      baseComponent: 'classic'
    },
    {
      id: 'finance-professional',
      name: 'Finance Professional',
      category: 'Finance',
      cost: 55,
      atsScore: 96,
      popularity: 82,
      description: 'Conservative, highly structured layout preferred by banks.',
      baseComponent: 'classic'
    },
    {
      id: 'software-engineer-ats',
      name: 'Software Engineer ATS+',
      category: 'Tech',
      cost: 80,
      atsScore: 100,
      popularity: 96,
      description: 'Guaranteed to parse perfectly in Workday, Greenhouse, and Lever.',
      baseComponent: 'classic'
    },
    {
      id: 'luxury-gold',
      name: 'Luxury Gold',
      category: 'Premium',
      cost: 100,
      atsScore: 85,
      popularity: 70,
      description: 'Exclusive design with elegant serif typography and gold accents.',
      baseComponent: 'classic'
    },
    {
      id: 'startup-founder',
      name: 'Startup Founder',
      category: 'Leadership',
      cost: 70,
      atsScore: 90,
      popularity: 88,
      description: 'Highlight impact, growth metrics, and entrepreneurial ventures.',
      baseComponent: 'modern',
      colorTheme: 'emerald'
    },
    {
      id: 'european-cv',
      name: 'European CV',
      category: 'International',
      cost: 45,
      atsScore: 85,
      popularity: 60,
      description: 'Europass-inspired layout standard for EU applications.',
      baseComponent: 'modern'
    },
    {
      id: 'german-bewerbung',
      name: 'German Bewerbung',
      category: 'International',
      cost: 50,
      atsScore: 88,
      popularity: 55,
      description: 'Strictly formatted to meet DACH region application standards.',
      baseComponent: 'classic'
    },
    {
      id: 'healthcare-professional',
      name: 'Healthcare Professional',
      category: 'Medical',
      cost: 55,
      atsScore: 95,
      popularity: 78,
      description: 'Clean, clinical layout emphasizing licenses and clinical experience.',
      baseComponent: 'classic'
    }
  ];