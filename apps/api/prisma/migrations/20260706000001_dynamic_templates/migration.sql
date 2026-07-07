-- CreateTable: dynamic_templates
-- Admin-created HTML templates with placeholder variables.
-- These supplement the code-registered templates in packages/templates
-- and require no deployment to add.

CREATE TABLE "dynamic_templates" (
    "id"           TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "slug"         TEXT         NOT NULL,
    "category"     TEXT         NOT NULL DEFAULT 'free',
    "templateHtml" TEXT         NOT NULL,
    "thumbnailUrl" TEXT,
    "pointsCost"   INTEGER      NOT NULL DEFAULT 0,
    "displayOrder" INTEGER      NOT NULL DEFAULT 0,
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "promptUsed"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dynamic_templates_slug_key" ON "dynamic_templates"("slug");
CREATE INDEX "dynamic_templates_isActive_displayOrder_idx" ON "dynamic_templates"("isActive", "displayOrder");
