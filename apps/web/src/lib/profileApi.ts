import type {
    ProfileWithFacts,
    ProfileFact,
    UpsertProfileFactRequest,
    ProfileFactCategory,
  } from '@careerforge/schema';
  import { request } from './api.js';  // re-uses the existing request helper
  
  /**
   * API client for the /api/profile domain.
   * All functions return typed data or throw ApiError.
   */
  
  export async function fetchProfile(): Promise<ProfileWithFacts> {
    return request<ProfileWithFacts>('/profile');
  }
  
  export async function fetchFactsByCategory(category: ProfileFactCategory): Promise<ProfileFact[]> {
    const data = await request<{ facts: ProfileFact[] }>(`/profile/facts?category=${category}`);
    return data.facts;
  }
  
  export async function upsertFact(input: UpsertProfileFactRequest): Promise<ProfileFact> {
    const encodedKey = encodeURIComponent(input.key);
    const data = await request<{ fact: ProfileFact }>(`/profile/facts/${encodedKey}`, {
      method: 'PUT',
      body: input,
    });
    return data.fact;
  }
  
  export async function deleteFact(key: string): Promise<void> {
    await request(`/profile/facts/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }