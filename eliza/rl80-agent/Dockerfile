# HAIL MARY Debate Agents — Saint GR80 vs H80Z
# ElizaOS Two-Agent Philosophical Debate System

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

# Copy package files and patches for install
COPY package.json bun.lock* ./
COPY patches/ ./patches/

# Install dependencies (postinstall applies discovery self-reply patch)
RUN bun install

# Copy the rest of the application
COPY . .

# Ensure patch is applied (in case postinstall was skipped)
RUN node patches/fix-discovery-self-reply.cjs

# Build the application
RUN bun run build

# Create wrapper script for elizaos CLI
RUN echo '#!/bin/bash\nexec /app/node_modules/.bin/elizaos "$@"' > /usr/local/bin/elizaos && \
    chmod +x /usr/local/bin/elizaos

# Railway uses PORT env var
ENV PORT=3000
ENV SERVER_PORT=3000
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose the port
EXPOSE 3000

# Start debate agents — use shell form to fix volume permissions at runtime
CMD mkdir -p /app/.eliza/.elizadb && elizaos start
