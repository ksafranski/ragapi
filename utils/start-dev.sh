#!/bin/bash
# Development Entrypoint Script
# ==============================
# Starts only backend services (QDrant + Ollama) for local development.
# Run the Bun API separately with `bun run dev` for hot reload.

set -e

echo "🚀 Starting backend services (dev mode)..."

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

echo ""
echo "✅ Backend services started!"
echo ""
echo "   📦 QDrant:  http://localhost:6333 (HTTP), localhost:6334 (gRPC)"
echo "   🤖 Ollama:  http://localhost:11434"
echo ""
echo "💡 Now run 'bun run dev' in another terminal to start the API server"
echo ""

# Handle shutdown gracefully
trap "echo 'Shutting down...'; kill $QDRANT_PID $OLLAMA_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Keep container running and forward signals
wait

