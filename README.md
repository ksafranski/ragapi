# RAGAPI

A lightweight unified API for RAG (Retrieval Augmented Generation) that sits on top of Qdrant and Ollama.

## Setup

```bash
# Install dependencies
bun install

# Start Qdrant + Ollama (via Docker)
docker compose up

# Start the API server
bun run dev
```

## Quick Start

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
