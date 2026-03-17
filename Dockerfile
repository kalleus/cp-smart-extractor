# ─────────────────────────────────────────────
#  Dockerfile — MCP Web Extractor
#  Multi-stage build: lean production image
# ─────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production ───────────────────────
FROM node:22-slim AS production

# Playwright system dependencies (Chromium)
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    fonts-liberation \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Production deps only, skip postinstall (we install playwright separately)
RUN npm ci --omit=dev --ignore-scripts

# Install Chromium for Playwright
RUN npx playwright install chromium --with-deps

COPY --from=builder /app/dist ./dist

# Railway uses stdio transport — no port needed
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
