# ─── BUILD STAGE ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for the root workspace dependency configuration
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install dependencies across the entire monorepo workspace
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build both the frontend and the api service apps
RUN npm run build

# ─── RUNTIME STAGE ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built files and production dependencies from builder stage
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package*.json ./apps/api/

EXPOSE 8000

# Start the new TypeScript API server
CMD ["node", "apps/api/dist/index.js"]