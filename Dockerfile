# Multi-service container: QDrant + Ollama + RAGAPI

# Stage 1: Get QDrant binary from official image
FROM qdrant/qdrant:latest AS qdrant

# Stage 2: Build the combined image
FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies (including libunwind8 for QDrant, unzip for Bun)
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    libunwind8 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy QDrant binary from official image
COPY --from=qdrant /qdrant/qdrant /usr/local/bin/qdrant

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Create directories for data persistence
RUN mkdir -p /data /models /app

# Set working directory for the app
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY src/ ./src/
COPY index.ts tsconfig.json ./

# Set environment variables
ENV QDRANT__STORAGE__PATH=/data
ENV OLLAMA_MODELS=/models
ENV OLLAMA_HOST=0.0.0.0
# Internal URLs for the app to connect to local services
ENV QDRANT_URL=http://localhost:6333
ENV OLLAMA_URL=http://localhost:11434
# Config file location (persisted via volume)
ENV CONFIG_PATH=/config/config.json

# Create config directory
RUN mkdir -p /config

# Expose ports
# QDrant HTTP API
EXPOSE 6333
# QDrant gRPC
EXPOSE 6334
# Ollama API
EXPOSE 11434
# RAGAPI
EXPOSE 3000

# Copy startup script
COPY utils/start.sh /start.sh
RUN chmod +x /start.sh

# Health check for all services
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:6333/health && curl -f http://localhost:11434/api/tags && curl -f http://localhost:3000/models || exit 1

# Set volumes for data persistence
VOLUME ["/data", "/models", "/config"]

# Start all services
CMD ["/start.sh"]
