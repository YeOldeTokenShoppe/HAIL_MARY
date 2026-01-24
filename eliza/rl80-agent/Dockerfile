# RL80 - Our Lady of Perpetual Profit
# ElizaOS Agent for HAIL_MARY Trading System

FROM node:23.3.0-slim

# Install essential dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    g++ \
    git \
    make \
    python3 \
    unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install bun globally
RUN npm install -g bun

# Add bun to PATH
ENV PATH="/root/.bun/bin:/home/node/.bun/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

# Create wrapper script for elizaos CLI
RUN echo '#!/bin/bash\nexec /app/node_modules/.bin/elizaos "$@"' > /usr/local/bin/elizaos && \
    chmod +x /usr/local/bin/elizaos

# Create node user directories and set ownership
RUN chown -R node:node /app && \
    mkdir -p /home/node/.bun && \
    chown -R node:node /home/node/.bun

# Switch to non-root user
USER node

# Railway uses PORT env var, ElizaOS uses SERVER_PORT
# Default to 3000 if not set
ENV PORT=3000
ENV SERVER_PORT=3000
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose the port
EXPOSE 3000

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start RL80
CMD ["elizaos", "start"]
