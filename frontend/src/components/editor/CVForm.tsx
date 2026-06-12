import React, { useRef } from 'react';
import { Textarea, Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Save, Camera } from 'lucide-react';
import type { CVData } from '../../types';

interface CVFormProps {
  data: CVData;
  setData: React.Dispatch<React.SetStateAction<CVData>>;
  onSave: () => void;
  isSaving: boolean;
}

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-6 mb-3 pb-2 border-b border-border">
    {children}
  </h3>
);

export function CVForm({ data, setData, onSave, isSaving }: CVFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setData((p) => ({ ...p, profileImage: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="p-5 space-y-4">
        {/* Profile Image */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center hover:bg-accent transition-colors cursor-pointer flex-none"
          >
            {data.profileImage ? (
              <img
                src={data.profileImage}
                alt="Profile"
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <Camera size={20} className="text-muted-foreground" />
            )}
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Profile Photo</p>
            <p className="text-xs text-muted-foreground">Optional — click to upload</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>

        {/* Basic Info */}
        <SectionHeading>Basic Info</SectionHeading>

        <Input label="Full Name" name="fullName" value={data.fullName} onChange={handleChange} placeholder="Jane Doe" />
        <Input label="Job Title" name="jobTitle" value={data.jobTitle} onChange={handleChange} placeholder="Senior Product Manager" />
        <Input label="Email" name="email" type="email" value={data.email} onChange={handleChange} placeholder="jane@example.com" />
        <Input label="Phone" name="phone" value={data.phone} onChange={handleChange} placeholder="+1 555 000 0000" />
        <Input label="Location" name="location" value={data.location} onChange={handleChange} placeholder="San Francisco, CA" />

        {/* Main Content */}
        <SectionHeading>Main Content</SectionHeading>

        <Textarea
          label="Professional Summary"
          name="summary"
          value={data.summary}
          onChange={handleChange}
          rows={4}
          placeholder="Brief overview of your professional background and key strengths..."
        />
        <Textarea
          label="Experience"
          name="experience"
          value={data.experience}
          onChange={handleChange}
          rows={6}
          placeholder="• Senior Engineer at TechCorp (2021–Present)&#10;  Led migration to microservices..."
        />
        <Textarea
          label="Education"
          name="education"
          value={data.education}
          onChange={handleChange}
          rows={3}
          placeholder="B.S. Computer Science, Stanford University, 2018"
        />
        <Textarea
          label="Skills (comma-separated)"
          name="skills"
          value={data.skills}
          onChange={handleChange}
          rows={2}
          placeholder="Python, React, TypeScript, PostgreSQL..."
        />

        {/* Additional */}
        <SectionHeading>Additional Details</SectionHeading>

        <Input label="Languages" name="languages" value={data.languages} onChange={handleChange} placeholder="English (Native), Spanish (Intermediate)" />
        <Input label="Certifications" name="certifications" value={data.certifications} onChange={handleChange} placeholder="AWS Solutions Architect, PMP" />
        <Input label="Hobbies / Interests" name="hobbies" value={data.hobbies} onChange={handleChange} placeholder="Photography, Open Source, Hiking" />

        {/* Social Links */}
        <SectionHeading>Links</SectionHeading>

        <Input label="LinkedIn" name="linkedin" value={data.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/janedoe" />
        <Input label="GitHub" name="github" value={data.github} onChange={handleChange} placeholder="https://github.com/janedoe" />
        <Input label="Portfolio" name="portfolio" value={data.portfolio} onChange={handleChange} placeholder="https://janedoe.com" />

        {/* Appearance */}
        <SectionHeading>Appearance</SectionHeading>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="accentColor"
                value={data.accentColor}
                onChange={handleChange}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer p-1 bg-card"
              />
              <Input name="accentColor" value={data.accentColor} onChange={handleChange} className="flex-1 font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="textColor"
                value={data.textColor}
                onChange={handleChange}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer p-1 bg-card"
              />
              <Input name="textColor" value={data.textColor} onChange={handleChange} className="flex-1 font-mono text-xs" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-foreground">Font Family</label>
          <select
            name="fontFamily"
            value={data.fontFamily}
            onChange={(e) => setData((p) => ({ ...p, fontFamily: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
          >
            <option value="Helvetica, Arial, sans-serif">Helvetica (Default)</option>
            <option value="'Times New Roman', Times, serif">Times New Roman</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          </select>
        </div>

        {/* Save Button */}
        <Button
          variant="brand"
          size="lg"
          onClick={onSave}
          isLoading={isSaving}
          className="w-full mt-4"
        >
          <Save size={16} className="mr-2" />
          {isSaving ? 'Saving...' : 'Save Resume'}
        </Button>
      </div>
    </div>
  );
}
