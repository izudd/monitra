FROM node:20-alpine

# Build tools untuk better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies dulu (cache layer)
COPY package*.json ./
RUN npm ci

# Copy semua source
COPY . .

# Build Vite frontend
RUN npm run build

EXPOSE 3000

# Start server dengan tsx (handles TypeScript langsung)
CMD ["npx", "tsx", "server.ts"]
