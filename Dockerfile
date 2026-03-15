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

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist

WORKDIR /app/server

EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
