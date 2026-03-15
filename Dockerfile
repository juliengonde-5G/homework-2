FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies and build
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

COPY server/ ./server/

# Generate Prisma client
RUN cd server && npx prisma generate

# Production image
FROM node:20-alpine

# Add non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

WORKDIR /app/server

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/legal/privacy || exit 1

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
