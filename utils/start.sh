#!/bin/bash
# Docker Entrypoint Script
# ========================
# This script is the CMD for the RAGAPI Docker container. It starts QDrant
# (vector database), Ollama (LLM server), and the RAGAPI Bun server within
# a single container, handles graceful shutdown, and keeps the container running.
#
# Used by: Dockerfile (COPY utils/start.sh /start.sh && CMD ["/start.sh"])

set -e

echo "🚀 Starting RAGAPI services..."

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

# Wait for backend services to be ready
echo "⏳ Waiting for backend services to initialize..."
sleep 5

# Start the RAGAPI Bun server
echo "🌐 Starting RAGAPI Server..."
cd /app
bun run src/server.ts &
RAGAPI_PID=$!

# Give the API a moment to start
sleep 2

echo ""
echo "✅ All services started!"
echo ""
echo "   🌐 RAGAPI:  http://localhost:3000"
echo "   📦 QDrant:  http://localhost:6333 (HTTP), localhost:6334 (gRPC)"
echo "   🤖 Ollama:  http://localhost:11434"
echo ""
echo "📊 Data volumes:"
echo "   - Vector DB: /data"
echo "   - LLM Models: /models"

# Handle shutdown gracefully
trap "echo 'Shutting down...'; kill $RAGAPI_PID $QDRANT_PID $OLLAMA_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Keep container running and forward signals
wait
