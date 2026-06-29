import type { ProfileFact as PrismaProfileFact } from '@prisma/client';
import type { ProfileCompleteness } from '@careerforge/schema';

/**
 * Completeness scoring is pure, deterministic, and runs without any I/O.
 * It is called after every profile read so the score is always current.
 * Rules are deliberately simple and explicit — no ML, no fuzzy heuristics.
 */

interface Dimension {
  score: number;       // 0–100 for this dimension
  missing: string[];   // human-readable gap descriptions
}

function scoreIdentity(facts: PrismaProfileFact[]): Dimension {
  const identity = facts.find((f) => f.category === 'IDENTITY');
  if (!identity) {
    return { score: 0, missing: ['Add your name, email, and location'] };
  }

  const v = identity.value as Record<string, unknown>;
  const required = ['fullName', 'email', 'location', 'headline'];
  const optional = ['phone', 'linkedin', 'website'];
  const filledRequired = required.filter((k) => v[k]).length;
  const filledOptional = optional.filter((k) => v[k]).length;

  // Required fields: 70 points total, optional: 30 points
  const score = Math.round((filledRequired / required.length) * 70 + (filledOptional / optional.length) * 30);
  const missing: string[] = [];
  if (!v.headline) missing.push('Add a professional headline');
  if (!v.phone) missing.push('Add a phone number');
  if (!v.linkedin) missing.push('Add your LinkedIn profile URL');

  return { score, missing };
}

function scoreExperience(facts: PrismaProfileFact[]): Dimension {
  const entries = facts.filter((f) => f.category === 'EXPERIENCE');
  if (entries.length === 0) {
    return { score: 0, missing: ['Add at least one work experience entry'] };
  }

  // Score = min(entries.length / 2, 1) * 60 + description quality * 40
  const countScore = Math.min(entries.length / 2, 1) * 60;
  const withDescriptions = entries.filter((e) => {
    const v = e.value as Record<string, unknown>;
    return v.description && String(v.description).length > 50;
  });
  const descScore = entries.length > 0 ? (withDescriptions.length / entries.length) * 40 : 0;
  const score = Math.round(countScore + descScore);

  const missing: string[] = [];
  const withoutDesc = entries.filter((e) => {
    const v = e.value as Record<string, unknown>;
    return !v.description || String(v.description).length < 50;
  });
  if (withoutDesc.length > 0) {
    missing.push(`Add descriptions to ${withoutDesc.length} experience entry/entries`);
  }
  return { score, missing };
}

function scoreEducation(facts: PrismaProfileFact[]): Dimension {
  const entries = facts.filter((f) => f.category === 'EDUCATION');
  if (entries.length === 0) {
    return { score: 0, missing: ['Add your education history'] };
  }
  const score = Math.min(entries.length * 60, 100);
  return { score, missing: [] };
}

function scoreSkills(facts: PrismaProfileFact[]): Dimension {
  const entries = facts.filter((f) => f.category === 'SKILL');
  if (entries.length === 0) {
    return { score: 0, missing: ['Add at least 3 skills'] };
  }
  const score = Math.min(Math.round((entries.length / 8) * 100), 100);
  const missing: string[] = [];
  if (entries.length < 3) missing.push('Add more skills (aim for at least 8)');
  return { score, missing };
}

function scoreGoals(facts: PrismaProfileFact[]): Dimension {
  const goal = facts.find((f) => f.category === 'GOAL');
  const pref = facts.find((f) => f.category === 'PREFERENCE');
  if (!goal && !pref) {
    return { score: 0, missing: ['Tell the AI your target role and career goals'] };
  }
  const score = goal && pref ? 100 : 50;
  const missing: string[] = [];
  if (!goal) missing.push('Add your target role or career goals');
  if (!pref) missing.push('Set your work preferences (remote/hybrid, location)');
  return { score, missing };
}

export function computeCompleteness(facts: PrismaProfileFact[]): ProfileCompleteness {
  const identity = scoreIdentity(facts);
  const experience = scoreExperience(facts);
  const education = scoreEducation(facts);
  const skills = scoreSkills(facts);
  const goals = scoreGoals(facts);

  // Weighted average: identity 20%, experience 35%, education 20%, skills 15%, goals 10%
  const overall = Math.round(
    identity.score * 0.2 +
    experience.score * 0.35 +
    education.score * 0.2 +
    skills.score * 0.15 +
    goals.score * 0.1,
  );

  const allMissing = [
    ...identity.missing,
    ...experience.missing,
    ...education.missing,
    ...skills.missing,
    ...goals.missing,
  ].slice(0, 5); // surface max 5 at a time to avoid overwhelming the user

  return {
    score: overall,
    breakdown: {
      identity: identity.score,
      experience: experience.score,
      education: education.score,
      skills: skills.score,
      goals: goals.score,
    },
    missingHighPriority: allMissing,
  };
}