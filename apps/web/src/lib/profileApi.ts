import type {
  ProfileWithFacts,
  ProfileFact,
  UpsertProfileFactRequest,
  ProfileFactCategory,
  PublicProfile,
  CareerProfileWithPublicFields,
  UpdatePublicProfileSettingsRequest,
} from '@careerforge/schema';
import { request } from './api.js';

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

/** No-auth lookup — used both for rendering /u/:slug and, by the settings
 * page, as an advisory availability check while a user is choosing a slug. */
export async function fetchPublicProfile(slug: string): Promise<PublicProfile> {
  const data = await request<{ profile: PublicProfile }>(`/profile/public/${encodeURIComponent(slug)}`);
  return data.profile;
}

export async function fetchOwnPublicProfileSettings(): Promise<CareerProfileWithPublicFields> {
  const data = await request<{ profile: CareerProfileWithPublicFields }>('/profile/public-settings');
  return data.profile;
}

export async function updatePublicProfileSettings(
  input: UpdatePublicProfileSettingsRequest,
): Promise<CareerProfileWithPublicFields> {
  const data = await request<{ profile: CareerProfileWithPublicFields }>('/profile/public-settings', {
    method: 'PATCH',
    body: input,
  });
  return data.profile;
}
