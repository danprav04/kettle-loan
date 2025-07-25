# Stage 1: Dependency installation
# This stage installs dependencies and is cached separately.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Application builder
# This stage builds the Next.js application.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables from .env.local are needed at build time
# for things like next-pwa configuration.
# You must pass these as build arguments in your GitHub Actions workflow.
# Example: --build-arg POSTGRES_URL=${{ secrets.POSTGRES_URL }}
ARG POSTGRES_URL
ARG JWT_SECRET
ENV POSTGRES_URL=${POSTGRES_URL}
ENV JWT_SECRET=${JWT_SECRET}

# The build command will now generate the `.next/standalone` directory
# because of the `output: 'standalone'` config.
RUN npm run build

# Stage 3: Production runner
# This is the final, minimal image that will be run.
FROM node:20-alpine AS runner
WORKDIR /app

# Correct, modern ENV syntax (key=value)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for better security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary files for the standalone output
COPY --from=builder /app/public ./public

# The standalone output copies server files and node_modules chunks.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the new, non-root user as the active user
USER nextjs

EXPOSE 3000

# The standalone output creates a `server.js` file to run the app.
CMD ["node", "server.js"]