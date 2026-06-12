# CareerForge — Merge Report & Architecture Guide

## Project Identity
**Name:** CareerForge  
**Positioning:** AI Career Platform  
**Tagline:** "Your career, forged by AI."

---

## 1. Source of Truth Decisions

| Domain | Source | Reason |
|--------|--------|--------|
| Backend API (FastAPI) | Project A | Fully working, tested, deployed |
| Database models | Project A | PostgreSQL-backed, production-tested |
| Authentication (JWT) | Project A | bcrypt + jose, correctly implemented |
| AI chat engine | Project A | Groq/OpenAI integration, file upload, CV generation |
| PDF export (WeasyPrint) | Project A | Production-tested PDF/DOCX pipeline |
| CV persistence | Project A | Full CRUD, user ownership, proper schemas |
| Template Mustache rendering | Project A | Battle-tested pystache rendering |
| Landing page | Project B | Animated, polished, brand-ready |
| Dashboard UI | Project B | Glass morphism design system |
| Builder/Editor UI | Merged | Project B layout + Project A data logic |
| Navigation | Project B | Framer Motion pill animation |
| Theme system | Project B | Tailwind dark mode with CSS variables |
| Marketplace UI | Merged | Project B UI + Project A live templates |
| TypeScript | New | Migrated from JSX; all new code strictly typed |

---

## 2. Files to Keep (from Project A backend — unchanged)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI app, lifespan, static serving
│   ├── main_api.py          ← All API routes (auth, cv, templates, ai, admin)
│   ├── database.py          ← SQLAlchemy engine + postgres/sqlite compat
│   ├── core/
│   │   ├── config.py        ← Settings (renamed PROJECT_NAME only)
│   │   └── security.py      ← JWT + bcrypt (untouched)
│   ├── models/
│   │   ├── user.py          ← User + credits wallet
│   │   ├── cv.py            ← CV with JSON blob
│   │   ├── template.py      ← HTML/CSS template store
│   │   └── package.py       ← Subscription packages
│   ├── schemas/
│   │   ├── cv.py            ← CVData with all sidebar fields
│   │   ├── user.py          ← UserCreate, Token, etc.
│   │   └── ai.py            ← AI generation request/response
│   ├── crud/
│   │   ├── cv.py            ← CV CRUD operations
│   │   ├── user.py          ← User CRUD
│   │   ├── template.py      ← Template CRUD
│   │   └── init_db.py       ← Template seeding on startup
│   └── services/
│       ├── ai_service.py    ← Groq/OpenAI integration
│       ├── file_service.py  ← PDF/DOCX generation
│       └── parser_service.py← Resume upload parsing
└── requirements.txt
```

---

## 3. Files to Delete (replaced or obsolete)

### From Project A frontend (entirely replaced by new TypeScript frontend):
```
frontend/src/App.jsx
frontend/src/main.jsx
frontend/src/App.css
frontend/src/index.css
frontend/src/components/AdminPage.jsx        ← Replaced by direct API access
frontend/src/components/AdminPage.css
frontend/src/components/CVForm.jsx           ← Replaced by editor/CVForm.tsx
frontend/src/components/CVPreview.jsx        ← Replaced by editor/CVPreview.tsx
frontend/src/components/ChatGeneratorPage.jsx← Replaced by chat/AIChatPage.tsx
frontend/src/components/ChatGeneratorPage.css
frontend/src/components/DashboardPage.jsx    ← Replaced by pages/DashboardPage.tsx
frontend/src/components/DashboardPage.css
frontend/src/components/EditorLayout.jsx
frontend/src/components/EditorLayout.css
frontend/src/components/GeneratorPage.jsx
frontend/src/components/InteractiveCVGenerator.jsx
frontend/src/components/LoginPage.jsx        ← Replaced by pages/LoginPage.tsx
frontend/src/components/PricingModal.jsx
frontend/src/components/PricingModal.css
frontend/src/components/ProtectedRoute.jsx   ← Replaced by auth/ProtectedRoute.tsx
frontend/src/components/RegisterPage.jsx     ← Replaced by pages/RegisterPage.tsx
frontend/src/components/TemplatePreview.jsx
frontend/src/components/TemplateSelector.jsx
frontend/src/components/TemplateSelector.css
frontend/src/components/TemplateStore.jsx    ← Replaced by pages/MarketplacePage.tsx
frontend/src/components/TemplateStore.css
frontend/src/components/ThemeToolbar.jsx     ← Merged into CVForm.tsx
frontend/src/context/useAuth.jsx             ← Replaced by context/AuthContext.tsx
frontend/src/services/api.js                 ← Replaced by services/api.ts
```

### From Project B (canvas/design-tool artifacts — not production):
```
src/canvas.manifest.js        ← MagicPatterns editor only, delete
src/useScreenInit.js          ← MagicPatterns editor only, delete
src/package.json              ← Nested duplicate, delete
src/index.tsx                 ← Uses old ReactDOM.render, replaced
```

---

## 4. Files Merged (logic from A + design from B)

| Output File | Logic From | Design From |
|-------------|-----------|-------------|
| `src/App.tsx` | Project A routing, state management | Project B AnimatePresence transitions |
| `src/main.tsx` | Project A routing structure | React 18 createRoot (upgrade) |
| `src/components/chat/AIChatPage.tsx` | Project A AI chat logic + upload | Project B chat bubble UI |
| `src/components/editor/CVForm.tsx` | Project A form fields (all custom fields) | Project B Input/Textarea components |
| `src/components/editor/CVPreview.tsx` | Project A Mustache rendering + download | Project B toolbar + zoom UI |
| `src/pages/EditorPage.tsx` | Project A save/autosave logic, CV state | Project B split-panel layout |
| `src/pages/DashboardPage.tsx` | Project A CV list + delete logic | Project B glass-morphism dashboard |
| `src/pages/MarketplacePage.tsx` | Project A real backend templates | Project B marketplace card UI |
| `src/components/layout/TopNav.tsx` | Project A navigation logic | Project B pill-animation nav |
| `src/context/AuthContext.tsx` | Project A useAuth logic | TypeScript rewrite |
| `src/services/api.ts` | Project A api.js | TypeScript rewrite + interceptors |

---

## 5. New Architecture

### Frontend Structure
```
frontend/src/
├── main.tsx                    Entry point (React 18, all providers)
├── App.tsx                     App shell + internal SPA router
├── index.css                   Design system (CSS variables, utilities)
│
├── types/index.ts              All TypeScript types (User, CVData, Template...)
├── lib/utils.ts                Shared utilities (cn, formatDate, etc.)
│
├── context/
│   ├── AuthContext.tsx         JWT auth state (login, register, logout)
│   └── AppStore.tsx            Points economy, subscriptions, owned templates
│
├── services/
│   └── api.ts                  Type-safe API layer (authApi, cvApi, templateApi, aiApi)
│
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx  Route guard
│   ├── chat/
│   │   └── AIChatPage.tsx      AI chat onboarding (full backend integration)
│   ├── editor/
│   │   ├── CVForm.tsx          All CV form fields (mirrors backend CVData schema)
│   │   └── CVPreview.tsx       Live Mustache preview + PDF/DOCX download
│   ├── layout/
│   │   └── TopNav.tsx          Navigation bar with Framer Motion pill
│   └── ui/
│       ├── Button.tsx          Animated button (6 variants)
│       └── Input.tsx           Input + Textarea with label/error
│
└── pages/
    ├── WelcomePage.tsx         Public landing page
    ├── LoginPage.tsx           Auth: sign in
    ├── RegisterPage.tsx        Auth: create account
    ├── EditorPage.tsx          Full builder with form + preview
    ├── DashboardPage.tsx       My resumes + stats + history
    └── MarketplacePage.tsx     Template store with unlock modal
```

### Data Flow
```
User registers → AuthContext (JWT stored as cf_token)
         ↓
WelcomePage → LoginPage/RegisterPage → [App shell loads]
         ↓
AIChatPage → calls /api/ai/chat → detects 'generate' action
         ↓
handleResumeGenerated() normalises snake_case → CVData
         ↓
EditorPage receives initialData → renders CVForm + CVPreview
         ↓
CVPreview fetches template from /api/templates/:id
CVPreview renders Mustache(template.html, cvData) → iframe isolation
         ↓
handleSave() → POST/PUT /api/cvs → returns CVRecord with ID
         ↓
handleDownload() → GET /api/cvs/:id/export/pdf → WeasyPrint PDF blob
```

---

## 6. API Contract (Frontend ↔ Backend)

All API calls go through `src/services/api.ts`:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/register` | POST | No | Create account |
| `/api/auth/login` | POST | No | Get JWT |
| `/api/auth/profile` | GET | JWT | Get user info |
| `/api/ai/chat` | POST | JWT | Chat + generate |
| `/api/ai/upload-resume` | POST | JWT | Parse uploaded PDF/DOCX |
| `/api/cvs` | GET | JWT | List user's CVs |
| `/api/cvs` | POST | JWT | Create CV |
| `/api/cvs/:id` | PUT | JWT | Update CV |
| `/api/cvs/:id` | DELETE | JWT | Delete CV |
| `/api/cvs/:id/export/:fmt` | GET | JWT | Download PDF/DOCX |
| `/api/templates` | GET | No | List all templates |
| `/api/templates/:id` | GET | No | Get template HTML/CSS |
| `/api/generate-pdf` | POST | No | Live preview (no auth) |

---

## 7. Subscription Architecture

Three tiers, designed for future Stripe integration:

| Plan | Price | Points/mo | Premium Templates | AI Generations |
|------|-------|-----------|-------------------|----------------|
| Basic | Free | 0 | Buy with points | 3/month |
| Professional | $12/mo | 500 | All included | Unlimited |
| Premium | $29/mo | 1000 | All included | Unlimited |

**Implementation:**  
- `User.subscription_plan` in DB (already exists)  
- `User.credits` in DB (already exists)  
- `AppStore.tsx` manages frontend points state  
- `AppStore.upgradePlan()` ready to wire to Stripe webhook  

To add Stripe: create `/api/subscriptions/checkout` → Stripe Session → webhook hits `/api/webhooks/stripe` → update `User.subscription_plan`

---

## 8. Template Marketplace — Points Flow

```
User earns points:
  - Welcome bonus: 100 pts (on register)
  - Professional plan: +500/mo
  - Premium plan: +1000/mo
  - Profile completion: +50 pts (TODO: backend endpoint)

User spends points:
  - startup_bold: 80 pts
  - executive_pro: 150 pts
  - silicon_valley: 120 pts
  - academic: 100 pts
  - finance_pro: 100 pts
  - healthcare: 120 pts
```

Points are currently managed in `AppStore.tsx` (client-side).  
To persist: add `user_templates` junction table + `POST /api/templates/:id/unlock` endpoint.

---

## 9. Future Expansion (Architecture is ready)

The app shell in `App.tsx` uses a `view` state string. Adding a new module is:

1. Create `src/pages/CoverLetterPage.tsx`
2. Add `'cover-letter'` to `AppView` type in `App.tsx`  
3. Add nav item to `TopNav.tsx`  
4. Add `<Route>` or `AnimatePresence` case in `App.tsx`  

Planned modules:
- `/cover-letter` — Cover Letter Generator  
- `/interview` — Interview Prep (mock questions)  
- `/linkedin` — LinkedIn Profile Optimizer  
- `/jobs` — Job Application Tracker  
- `/coaching` — AI Career Coaching  

---

## 10. Deployment Steps

### First Deploy

1. Push repo to GitHub (make sure `frontend/dist/` is in `.gitignore`)
2. Create new Render Web Service → Docker
3. Set environment variables in Render dashboard:
   - `GROQ_API_KEY` or `OPENAI_API_KEY`
   - `JWT_SECRET_KEY` (auto-generated)
   - `ADMIN_EMAIL`
   - `DATABASE_URL` (auto-linked from Render Postgres)
4. Deploy → Render builds Docker image (Stage 1: npm build, Stage 2: uvicorn)
5. Visit `/api/setup_production` once to seed templates

### Subsequent Updates

```bash
git add . && git commit -m "feat: ..." && git push
# Render auto-deploys on push
```

### Local Development

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev   # Runs on :5173, proxies /api → :8000
```

---

## 11. Key Technical Decisions

### Why SPA router in App.tsx instead of React Router pages?
The Editor, Chat, and Dashboard share live state (`pendingCVData`, `editingCV`). Using React Router would require URL params or context lifts. The internal view-state pattern (like Project B) keeps data flow simple and avoids re-fetching.

### Why keep `mustache` instead of moving to server-side rendering?
The live preview requires instant client-side re-rendering on every keystroke. Server-round-trips would make it sluggish. Mustache client-side rendering (from Project A) is the correct pattern here.

### Why `cf_token` instead of `token` for localStorage?
Avoids key collision with any other apps on the same domain during development.

### Why TypeScript strict mode with `noUnusedLocals: false`?
Strict types for correctness + relaxed unused warnings to not block the build when features are scaffolded but not yet wired.
