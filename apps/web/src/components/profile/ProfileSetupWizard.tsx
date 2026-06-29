import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProfileSetupStep } from '../../components/profile/ProfileSetupStep';
import { ProfileCompletionRing } from '../../components/profile/ProfileCompletionRing';
import { useProfileStore } from '../../store/profile.store';
import { upsertFact, fetchProfile } from '../../lib/profileApi';
import type { IdentityValue, ExperienceValue, EducationValue } from '@careerforge/schema';

// ---------------------------------------------------------------------------
// Each step definition: what it collects and how it maps to profile facts
// ---------------------------------------------------------------------------

type WizardStep = 'identity' | 'experience' | 'education' | 'skills' | 'goals';
const STEPS: WizardStep[] = ['identity', 'experience', 'education', 'skills', 'goals'];

const STEP_META: Record<WizardStep, { title: string; description: string }> = {
  identity: { title: 'About you', description: 'Name, contact info, headline' },
  experience: { title: 'Work experience', description: 'Your most recent role' },
  education: { title: 'Education', description: 'Highest qualification' },
  skills: { title: 'Skills', description: 'Your top technical skills' },
  goals: { title: 'Goals', description: 'What you\'re aiming for' },
};

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

interface IdentityForm {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  linkedin: string;
}

interface ExperienceForm {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
}

interface EducationForm {
  degree: string;
  field: string;
  institution: string;
  endDate: string;
}

interface SkillsForm {
  skills: string; // comma-separated
}

interface GoalsForm {
  targetRole: string;
  targetIndustry: string;
  targetCountry: string;
  workType: string;
}

// ---------------------------------------------------------------------------
// Step field component helper
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProfileSetupWizard() {
  const navigate = useNavigate();
  const { setProfile } = useProfileStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const [identity, setIdentity] = useState<IdentityForm>({
    fullName: '', email: '', phone: '', location: '', headline: '', linkedin: '',
  });
  const [experience, setExperience] = useState<ExperienceForm>({
    title: '', company: '', startDate: '', endDate: '', isCurrent: false, description: '',
  });
  const [education, setEducation] = useState<EducationForm>({
    degree: '', field: '', institution: '', endDate: '',
  });
  const [skills, setSkills] = useState<SkillsForm>({ skills: '' });
  const [goals, setGoals] = useState<GoalsForm>({
    targetRole: '', targetIndustry: '', targetCountry: '', workType: '',
  });

  const activeStep = STEPS[currentStep];

  const saveCurrentStep = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      switch (activeStep) {
        case 'identity': {
          if (!identity.fullName.trim()) {
            setError('Full name is required.');
            return false;
          }
          await upsertFact({
            category: 'IDENTITY',
            key: 'identity:primary',
            value: identity as IdentityValue,
            confidenceScore: 100,
            source: 'USER_CONFIRMED',
          });
          break;
        }
        case 'experience': {
          if (experience.title.trim() && experience.company.trim()) {
            const key = `experience:${experience.company.toLowerCase().replace(/\s+/g, '-')}:${Date.now()}`;
            await upsertFact({
              category: 'EXPERIENCE',
              key,
              value: experience as ExperienceValue,
              confidenceScore: 100,
              source: 'USER_CONFIRMED',
            });
          }
          break;
        }
        case 'education': {
          if (education.degree.trim() && education.institution.trim()) {
            const key = `education:${education.institution.toLowerCase().replace(/\s+/g, '-')}`;
            await upsertFact({
              category: 'EDUCATION',
              key,
              value: education as EducationValue,
              confidenceScore: 100,
              source: 'USER_CONFIRMED',
            });
          }
          break;
        }
        case 'skills': {
          const skillList = skills.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          await Promise.all(
            skillList.map((name) =>
              upsertFact({
                category: 'SKILL',
                key: `skill:${name.toLowerCase().replace(/\s+/g, '-')}`,
                value: { name },
                confidenceScore: 100,
                source: 'USER_CONFIRMED',
              }),
            ),
          );
          break;
        }
        case 'goals': {
          if (goals.targetRole.trim() || goals.targetIndustry.trim()) {
            await upsertFact({
              category: 'GOAL',
              key: 'goal:primary',
              value: goals,
              confidenceScore: 100,
              source: 'USER_CONFIRMED',
            });
          }
          if (goals.workType) {
            await upsertFact({
              category: 'PREFERENCE',
              key: 'preference:work_type',
              value: { workType: goals.workType },
              confidenceScore: 100,
              source: 'USER_CONFIRMED',
            });
          }
          break;
        }
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed. Please try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activeStep, identity, experience, education, skills, goals]);

  const handleNext = async () => {
    const ok = await saveCurrentStep();
    if (!ok) return;

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Wizard complete — refresh profile store then navigate
      const updated = await fetchProfile();
      setProfile(updated);
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  // Completion screen
  if (isComplete) {
    return (
      <AppShell>
        <div className="min-h-full flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-3xl p-12 text-center max-w-md w-full"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <CheckCircle2 size={64} className="text-emerald-500" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Profile complete!</h2>
            <p className="text-muted-foreground mb-8">
              The AI now knows your background and can assist you much more effectively.
            </p>
            <div className="flex gap-3 flex-col sm:flex-row">
              <Button className="flex-1" onClick={() => navigate('/app/resumes/new/chat')}>
                Build a resume with AI
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => navigate('/app/profile')}>
                View profile
              </Button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-full bg-background p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/app/profile')}
              aria-label="Exit setup"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Profile setup</h1>
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Step list sidebar */}
            <div className="lg:w-64 shrink-0 glass-panel rounded-3xl p-4 space-y-1 h-fit">
              {STEPS.map((step, i) => (
                <ProfileSetupStep
                  key={step}
                  stepNumber={i + 1}
                  totalSteps={STEPS.length}
                  title={STEP_META[step].title}
                  description={STEP_META[step].description}
                  isCompleted={i < currentStep}
                  isActive={i === currentStep}
                />
              ))}
            </div>

            {/* Active step form */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="glass-panel rounded-3xl p-6 space-y-5"
                >
                  <div>
                    <h2 className="text-xl font-bold">{STEP_META[activeStep].title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeStep === 'identity' && 'This is what appears at the top of your resume.'}
                      {activeStep === 'experience' && 'Start with your most recent role. You can add more later.'}
                      {activeStep === 'education' && 'Your highest or most relevant qualification.'}
                      {activeStep === 'skills' && 'Separate skills with commas, e.g. TypeScript, React, PostgreSQL'}
                      {activeStep === 'goals' && 'Help the AI tailor its suggestions to your goals.'}
                    </p>
                  </div>

                  {activeStep === 'identity' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Full name" required>
                          <Input value={identity.fullName} onChange={(e) => setIdentity((s) => ({ ...s, fullName: e.target.value }))} placeholder="Jane Smith" />
                        </Field>
                        <Field label="Email">
                          <Input type="email" value={identity.email} onChange={(e) => setIdentity((s) => ({ ...s, email: e.target.value }))} placeholder="jane@example.com" />
                        </Field>
                      </div>
                      <Field label="Professional headline" required>
                        <Input value={identity.headline} onChange={(e) => setIdentity((s) => ({ ...s, headline: e.target.value }))} placeholder="Senior Frontend Engineer · React · TypeScript" />
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Location">
                          <Input value={identity.location} onChange={(e) => setIdentity((s) => ({ ...s, location: e.target.value }))} placeholder="Berlin, Germany" />
                        </Field>
                        <Field label="Phone">
                          <Input value={identity.phone} onChange={(e) => setIdentity((s) => ({ ...s, phone: e.target.value }))} placeholder="+49 170 123 4567" />
                        </Field>
                      </div>
                      <Field label="LinkedIn URL">
                        <Input value={identity.linkedin} onChange={(e) => setIdentity((s) => ({ ...s, linkedin: e.target.value }))} placeholder="linkedin.com/in/janesmith" />
                      </Field>
                    </div>
                  )}

                  {activeStep === 'experience' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Job title">
                          <Input value={experience.title} onChange={(e) => setExperience((s) => ({ ...s, title: e.target.value }))} placeholder="Senior Engineer" />
                        </Field>
                        <Field label="Company">
                          <Input value={experience.company} onChange={(e) => setExperience((s) => ({ ...s, company: e.target.value }))} placeholder="Acme Corp" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Start date">
                          <Input value={experience.startDate} onChange={(e) => setExperience((s) => ({ ...s, startDate: e.target.value }))} placeholder="Jan 2022" />
                        </Field>
                        <Field label="End date">
                          <Input value={experience.endDate} onChange={(e) => setExperience((s) => ({ ...s, endDate: e.target.value }))} placeholder="Present" disabled={experience.isCurrent} />
                        </Field>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={experience.isCurrent} onChange={(e) => setExperience((s) => ({ ...s, isCurrent: e.target.checked, endDate: '' }))} className="rounded" />
                        <span className="text-sm">I currently work here</span>
                      </label>
                      <Field label="Description">
                        <textarea
                          value={experience.description}
                          onChange={(e) => setExperience((s) => ({ ...s, description: e.target.value }))}
                          placeholder="Describe your responsibilities and achievements..."
                          rows={4}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                      </Field>
                    </div>
                  )}

                  {activeStep === 'education' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Degree">
                          <Input value={education.degree} onChange={(e) => setEducation((s) => ({ ...s, degree: e.target.value }))} placeholder="Bachelor of Science" />
                        </Field>
                        <Field label="Field of study">
                          <Input value={education.field} onChange={(e) => setEducation((s) => ({ ...s, field: e.target.value }))} placeholder="Computer Science" />
                        </Field>
                      </div>
                      <Field label="Institution">
                        <Input value={education.institution} onChange={(e) => setEducation((s) => ({ ...s, institution: e.target.value }))} placeholder="University of Berlin" />
                      </Field>
                      <Field label="Graduation year">
                        <Input value={education.endDate} onChange={(e) => setEducation((s) => ({ ...s, endDate: e.target.value }))} placeholder="2020" />
                      </Field>
                    </div>
                  )}

                  {activeStep === 'skills' && (
                    <div className="space-y-4">
                      <Field label="Skills (comma-separated)">
                        <textarea
                          value={skills.skills}
                          onChange={(e) => setSkills({ skills: e.target.value })}
                          placeholder="TypeScript, React, Node.js, PostgreSQL, Docker, AWS"
                          rows={4}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                      </Field>
                      {skills.skills && (
                        <div className="flex flex-wrap gap-2">
                          {skills.skills.split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
                            <span key={skill} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeStep === 'goals' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Target role">
                          <Input value={goals.targetRole} onChange={(e) => setGoals((s) => ({ ...s, targetRole: e.target.value }))} placeholder="Senior Product Manager" />
                        </Field>
                        <Field label="Target industry">
                          <Input value={goals.targetIndustry} onChange={(e) => setGoals((s) => ({ ...s, targetIndustry: e.target.value }))} placeholder="FinTech, SaaS, Healthcare..." />
                        </Field>
                      </div>
                      <Field label="Preferred country">
                        <Input value={goals.targetCountry} onChange={(e) => setGoals((s) => ({ ...s, targetCountry: e.target.value }))} placeholder="Germany, UK, Remote..." />
                      </Field>
                      <Field label="Work preference">
                        <select
                          value={goals.workType}
                          onChange={(e) => setGoals((s) => ({ ...s, workType: e.target.value }))}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Select preference...</option>
                          <option value="REMOTE">Remote</option>
                          <option value="HYBRID">Hybrid</option>
                          <option value="ON_SITE">On-site</option>
                          <option value="FLEXIBLE">Flexible</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  {/* Error */}
                  {error && <p className="text-sm text-destructive">{error}</p>}

                  {/* Navigation */}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      disabled={currentStep === 0 || isSaving}
                    >
                      <ArrowLeft size={16} className="mr-2" />
                      Back
                    </Button>
                    <Button onClick={handleNext} disabled={isSaving}>
                      {isSaving
                        ? 'Saving…'
                        : currentStep === STEPS.length - 1
                        ? 'Finish'
                        : 'Next'}
                      {!isSaving && currentStep < STEPS.length - 1 && (
                        <ArrowRight size={16} className="ml-2" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}