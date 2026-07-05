-- AddColumn: chatMessages on resumes
-- Migration: 20260705000000_resume_chat_messages
--
-- Persists the AI chat builder's full { role, content } transcript against
-- the resume it produced, so navigating back to /resumes/:resumeId/chat can
-- resume the actual conversation instead of always starting fresh. Existing
-- rows get an empty array, matching "no chat associated with this resume"
-- for resumes created any other way.

ALTER TABLE "resumes" ADD COLUMN "chatMessages" JSONB NOT NULL DEFAULT '[]';
