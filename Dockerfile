# ─── BUILD STAGE ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy the entire monorepo structure first so npm workspaces can see each other
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Copy the rest of the workspace source code
COPY . .

# Install dependencies using standard install to accommodate missing lockfiles safely
RUN npm install

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