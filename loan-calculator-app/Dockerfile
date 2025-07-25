# Stage 1: Dependency installation
# This stage installs dependencies and is cached separately.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Application builder
# This stage builds the Next.js application. It does NOT need secrets.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Secrets are NOT needed at build time. The build will proceed without them.
# The `output: 'standalone'` config will prepare the app for production.
RUN npm run build

# Stage 3: Production runner
# This is the final, minimal image that will be run.
FROM node:20-alpine AS runner
WORKDIR /app

# Correct, modern ENV syntax (key=value)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# At this stage, you MUST provide the runtime environment variables.
# For example, in your deployment platform (Kubernetes, Docker Compose, etc.):
# -e POSTGRES_URL=...
# -e JWT_SECRET=...
# We are only declaring them here so the Node.js process knows to expect them.
ENV POSTGRES_URL=""
ENV JWT_SECRET=""

# Create a non-root user for better security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary files for the standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the new, non-root user as the active user
USER nextjs

EXPOSE 3000

# The standalone output creates a `server.js` file to run the app.
CMD ["node", "server.js"]