# RAGAPI

A lightweight unified API for RAG (Retrieval Augmented Generation) that bundles Qdrant, Ollama, and a simple REST API into a single container.

## Quick Start

### Option 1: Pre-built Docker Image (Recommended)

```bash
docker run \
  --name ragapi \
  -p 3000:3000 \
  -p 6333:6333 \
  -p 11434:11434 \
  -v $(pwd)/collections:/data \
  -v $(pwd)/models:/models \
  -v $(pwd)/config:/config \
  ghcr.io/ksafranski/ragapi:latest
```

### Option 2: Docker Compose (Local Build)

Clone the repo and build locally:

```bash
# Clone and start
git clone https://github.com/ksafranski/ragcli.git
cd ragcli
docker compose up
```

The first build will take a few minutes. Once you see "All services started!", you're good to go.

## Basic Usage

### 1. Pull the models

You'll need an embedding model and an LLM. Let's grab `nomic-embed-text` for embeddings and `llama3.2:1b` (small and fast) for generation:

```bash
# Pull embedding model
curl -X POST http://localhost:3000/models/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "nomic-embed-text"}'

# Pull LLM
curl -X POST http://localhost:3000/models/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.2:1b"}'
```

### 2. Create a collection

Create a collection and associate it with your embedding model. You'll never have to specify the embedding model again for this collection:

```bash
curl -X POST http://localhost:3000/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "embeddingModel": "nomic-embed-text"}'
```

### 3. Add some documents

Insert documents - they'll be automatically embedded:

```bash
curl -X POST http://localhost:3000/collections/test/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"content": "The capital of France is Paris. It is known for the Eiffel Tower."},
      {"content": "Tokyo is the capital of Japan. It has a population of over 13 million."},
      {"content": "Berlin is the capital of Germany. The Berlin Wall fell in 1989."}
    ]
  }'
```

### 4. Search the collection

Verify your documents are there by searching:

```bash
curl -X POST http://localhost:3000/collections/test/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the capital of France?"}'
```

### 5. Query (with or without RAG)

**With RAG context** - searches the collection and uses results as context:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "collection": "test",
    "query": "What is the capital of France and what is it famous for?"
  }'
```

**Without RAG** - just prompt the model directly:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "What is 2 + 2?"
  }'
```

Responses stream back as newline-delimited JSON. When using RAG, the final line includes the source documents that were used as context.

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 3000 | RAGAPI | Main API (use this one) |
| 6333 | Qdrant | Vector DB HTTP API (direct access) |
| 6334 | Qdrant | Vector DB gRPC |
| 11434 | Ollama | LLM API (direct access) |

## Data Persistence

Data is stored in local directories that are mounted into the container:

- `./collections/` - Vector database storage
- `./models/` - Downloaded LLM models (can get large!)
- `./config/` - Collection metadata (embedding model mappings)

---

## Development

If you want to work on the API itself, run the backend services separately so you can use hot reload:

```bash
# Install dependencies
bun install

# Start just the backend services (Qdrant + Ollama)
docker compose -f docker-compose.dev.yml up

# In another terminal, start the API server with hot reload
bun run dev
```

The dev compose file uses `Dockerfile.dev` and `utils/start-dev.sh` which only start Qdrant and Ollama, leaving port 3000 free for your local Bun server.
