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
# The build command will now generate the `.next/standalone` directory
# because of the `output: 'standalone'` config.
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

# Copy the standalone output from the builder stage
# This will now work correctly
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./

# Copy the public assets and static files
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Expose the port the app will run on
EXPOSE 3000
ENV PORT 3000

# The command to start the app is now the server.js inside the standalone folder
CMD ["node", "server.js"]