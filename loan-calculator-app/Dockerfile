# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# This environment variable is necessary for the build command to find the .env.local file
# It can be an empty secret if you don't have build-time secrets
ARG NEXT_PUBLIC_ENV
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S nextjs
RUN adduser -S nextjs -G nextjs
USER nextjs

ENV NODE_ENV=production

# Copy the standalone output from the builder stage
COPY --from=builder /app/.next/standalone ./
# Copy the public assets and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Expose the port the app runs on
EXPOSE 3000

# The command to start the application
CMD ["node", "server.js"]