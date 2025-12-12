#!/bin/bash
# Docker Entrypoint Script
# ========================
# This script is the CMD for the RAGAPI Docker container. It starts both
# QDrant (vector database) and Ollama (LLM server) within a single container,
# handles graceful shutdown on SIGTERM/SIGINT, and keeps the container running.
#
# Used by: Dockerfile (COPY utils/start.sh /start.sh && CMD ["/start.sh"])

set -e

echo "🚀 Starting RAG services..."

# Start QDrant in the background
echo "📦 Starting QDrant Vector Database..."
qdrant --uri http://0.0.0.0:6333 &
QDRANT_PID=$!

# Give QDrant a moment to initialize
sleep 2

# Start Ollama serve in the background
echo "🤖 Starting Ollama LLM Server..."
ollama serve &
OLLAMA_PID=$!

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 5

echo "✅ Services started!"
echo "   - QDrant:  http://localhost:6333 (HTTP), localhost:6334 (gRPC)"
echo "   - Ollama:  http://localhost:11434"
echo ""
echo "📊 Data volumes:"
echo "   - Vector DB: /data"
echo "   - LLM Models: /models"

# Handle shutdown gracefully
trap "echo 'Shutting down...'; kill $QDRANT_PID $OLLAMA_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Keep container running and forward signals
wait


