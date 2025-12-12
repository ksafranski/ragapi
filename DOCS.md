# RAG CLI API Documentation

A simple, self-contained RAG (Retrieval-Augmented Generation) API that combines Qdrant vector database and Ollama LLM into a single, easy-to-use interface.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [API Tokens](#api-tokens)
  - [Collections](#collections)
  - [Documents](#documents)
  - [Search](#search)
  - [Models](#models)
  - [Query (RAG)](#query-rag)
  - [Direct LLM Access](#direct-llm-access)
- [Response Format](#response-format)
- [Error Handling](#error-handling)

---

## Getting Started

### Start the Services

```bash
# Start Qdrant and Ollama via Docker
docker compose up -d

# Start the API server
bun run src/server.ts
```

The API runs on `http://localhost:3000` by default (configurable via `PORT` env var).

### Quick Example: RAG in 3 Steps

```bash
# 1. Create a collection (auto-pulls embedding model if needed)
curl -X POST http://localhost:3000/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "docs", "embeddingModel": "nomic-embed-text"}'

# 2. Add documents
curl -X POST http://localhost:3000/collections/docs/documents \
  -H "Content-Type: application/json" \
  -d '{"documents": [
    {"content": "Bun is a fast JavaScript runtime."},
    {"content": "Qdrant is a vector database for similarity search."}
  ]}'

# 3. Query with RAG
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.2:1b", "collection": "docs", "prompt": "What is Bun?"}'
```

---

## Authentication

Authentication is **optional by default**. The API is open until you create your first API token.

### How It Works

| State | Behavior |
|-------|----------|
| No tokens exist | All endpoints accessible without authentication |
| Tokens exist | All endpoints (except `/health`) require `Authorization: Bearer <token>` header |

### Using Authentication

```bash
# Add the Authorization header to requests
curl http://localhost:3000/collections \
  -H "Authorization: Bearer your-token-here"
```

> **Note:** The `/health` endpoint is always accessible without authentication.

---

## API Endpoints

### Health Check

Check if the API is running and see available endpoints.

#### `GET /health` or `GET /`

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "authEnabled": false,
  "endpoints": {
    "apiTokens": "/api-tokens",
    "collections": "/collections",
    "models": "/models",
    "query": "/query",
    "embed": "/embed",
    "generate": "/generate",
    "chat": "/chat"
  }
}
```

---

### API Tokens

Manage authentication tokens for securing your API.

#### `GET /api-tokens` — List All Tokens

Returns all tokens (without the actual token values - those are only shown once on creation).

```bash
curl http://localhost:3000/api-tokens
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Production API Key",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### `POST /api-tokens` — Create Token

Creates a new API token. **The token value is only returned once** — save it immediately!

```bash
curl -X POST http://localhost:3000/api-tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "My App Token"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | A friendly name for the token |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My App Token",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "token": "abc123...xyz789"
  }
}
```

> ⚠️ **Important:** Copy the `token` value immediately! It's a 75-character alphanumeric string that cannot be retrieved again.

#### `GET /api-tokens/:id` — Get Token Details

```bash
curl http://localhost:3000/api-tokens/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My App Token",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `DELETE /api-tokens/:id` — Delete Token

```bash
curl -X DELETE http://localhost:3000/api-tokens/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true
}
```

> **Note:** Deleting all tokens disables authentication, making the API open again.

---

### Collections

Collections are containers for your documents. Each collection is tied to a specific embedding model.

#### `GET /collections` — List All Collections

```bash
curl http://localhost:3000/collections
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "docs",
      "embeddingModel": "nomic-embed-text",
      "dimension": 768,
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

#### `POST /collections` — Create Collection

Creates a new collection. The embedding model will be auto-pulled if not already available.

```bash
curl -X POST http://localhost:3000/collections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-docs",
    "embeddingModel": "nomic-embed-text"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique collection name |
| `embeddingModel` | string | Yes | Ollama embedding model to use |
| `dimension` | number | No | Vector dimension (auto-detected if omitted) |
| `distance` | string | No | Distance metric: `Cosine` (default), `Euclid`, or `Dot` |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "name": "my-docs",
    "embeddingModel": "nomic-embed-text",
    "dimension": 768,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

#### `GET /collections/:name` — Get Collection Details

```bash
curl http://localhost:3000/collections/my-docs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "my-docs",
    "embeddingModel": "nomic-embed-text",
    "dimension": 768,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "qdrant": {
      "vectors_count": 42,
      "points_count": 42,
      "status": "green"
    }
  }
}
```

#### `DELETE /collections/:name` — Delete Collection

Permanently deletes a collection and all its documents.

```bash
curl -X DELETE http://localhost:3000/collections/my-docs
```

**Response:**
```json
{
  "success": true
}
```

---

### Documents

Add, list, and remove documents from collections. Documents are automatically embedded using the collection's embedding model.

#### `POST /collections/:name/documents` — Insert Documents

Add one or more documents to a collection. Embeddings are generated automatically.

**Insert multiple documents:**
```bash
curl -X POST http://localhost:3000/collections/docs/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"content": "First document text", "metadata": {"source": "file1.txt"}},
      {"content": "Second document text", "metadata": {"source": "file2.txt"}}
    ]
  }'
```

**Insert a single document (shorthand):**
```bash
curl -X POST http://localhost:3000/collections/docs/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My document content",
    "metadata": {"author": "John", "category": "tutorial"}
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documents` | array | Yes* | Array of document objects |
| `content` | string | Yes* | Document text (shorthand for single doc) |
| `metadata` | object | No | Arbitrary metadata to store with the document |

*Either `documents` array or `content` string is required.

**Document Object:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Custom ID (auto-generated UUID if omitted) |
| `content` | string | Yes | The document text |
| `metadata` | object | No | Arbitrary key-value metadata |

**Response:**
```json
{
  "success": true,
  "data": {
    "inserted": 2,
    "ids": ["uuid-1", "uuid-2"]
  }
}
```

#### `GET /collections/:name/documents` — List Documents

Retrieve documents from a collection with pagination.

```bash
curl "http://localhost:3000/collections/docs/documents?limit=10&offset=abc123"
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of documents to return |
| `offset` | string | — | Pagination cursor from previous response |

**Response:**
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "id": "uuid-1",
        "payload": {
          "content": "Document text here",
          "source": "file1.txt"
        }
      }
    ],
    "next_page_offset": "xyz789"
  }
}
```

#### `DELETE /collections/:name/documents` — Delete Documents

Remove specific documents by their IDs.

```bash
curl -X DELETE http://localhost:3000/collections/docs/documents \
  -H "Content-Type: application/json" \
  -d '{"ids": ["uuid-1", "uuid-2"]}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | array | Yes | Array of document IDs to delete |

**Response:**
```json
{
  "success": true
}
```

---

### Search

Perform semantic similarity search on a collection.

#### `POST /collections/:name/search` — Search Documents

Find documents similar to a query. The query is automatically embedded using the collection's model.

```bash
curl -X POST http://localhost:3000/collections/docs/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does vector search work?",
    "limit": 5,
    "score_threshold": 0.7
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query text |
| `limit` or `top_k` | number | No | Max results (default: 10) |
| `score_threshold` | number | No | Minimum similarity score (0-1) |
| `filter` | object | No | Qdrant filter for metadata |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "content": "Vector search finds similar items...",
      "score": 0.92,
      "metadata": {"source": "vectors.md"}
    },
    {
      "id": "uuid-2",
      "content": "Embeddings represent text as numbers...",
      "score": 0.85,
      "metadata": {"source": "embeddings.md"}
    }
  ]
}
```

**Using Filters:**
```bash
curl -X POST http://localhost:3000/collections/docs/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "limit": 5,
    "filter": {
      "must": [
        {"key": "category", "match": {"value": "tutorial"}}
      ]
    }
  }'
```

---

### Models

Manage Ollama models (both LLM and embedding models).

#### `GET /models` — List All Models

```bash
curl http://localhost:3000/models
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "llama3.2:1b",
      "size": 1234567890,
      "modified_at": "2025-01-15T10:00:00.000Z",
      "digest": "sha256:abc123..."
    },
    {
      "name": "nomic-embed-text:latest",
      "size": 274302450,
      "modified_at": "2025-01-15T09:00:00.000Z",
      "digest": "sha256:def456..."
    }
  ]
}
```

#### `GET /models/:name` — Get Model Details

```bash
curl http://localhost:3000/models/llama3.2:1b
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelfile": "...",
    "parameters": "...",
    "template": "...",
    "details": {
      "format": "gguf",
      "family": "llama",
      "parameter_size": "1B",
      "quantization_level": "Q4_0"
    }
  }
}
```

#### `POST /models/pull` — Pull a Model

Download a model from Ollama registry. Returns a streaming response with progress updates.

```bash
curl -X POST http://localhost:3000/models/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.2:1b"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Model name (e.g., `llama3.2:1b`, `nomic-embed-text`) |

**Response (streaming NDJSON):**
```
{"status":"pulling manifest"}
{"status":"downloading","completed":1234567,"total":9876543}
{"status":"verifying sha256 digest"}
{"status":"success"}
```

#### `POST /models/copy` — Copy a Model

Create a copy of an existing model with a new name.

```bash
curl -X POST http://localhost:3000/models/copy \
  -H "Content-Type: application/json" \
  -d '{"source": "llama3.2:1b", "destination": "my-llama"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | Existing model name |
| `destination` | string | Yes | New model name |

**Response:**
```json
{
  "success": true
}
```

#### `DELETE /models/:name` — Delete a Model

```bash
curl -X DELETE http://localhost:3000/models/llama3.2:1b
```

**Response:**
```json
{
  "success": true
}
```

---

### Query (RAG)

The unified endpoint for querying with or without RAG context. This is the main endpoint for interacting with your LLM.

#### `POST /query` — Query with Optional RAG

**Simple query (no RAG):**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "What is the capital of France?"
  }'
```

**RAG query (with collection context):**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "collection": "docs",
    "prompt": "How do I configure the server?",
    "limit": 3
  }'
```

**Chat-style query:**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "collection": "docs",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "How do I use async/await?"}
    ]
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | LLM model to use |
| `prompt` | string | Yes* | Query text |
| `messages` | array | Yes* | Chat messages array |
| `collection` | string | No | Collection for RAG context |
| `query` | string | No | Search query (defaults to `prompt`) |
| `limit` or `top_k` | number | No | Number of RAG results (default: 5) |
| `score_threshold` | number | No | Min similarity score for RAG |
| `system` | string | No | System prompt override |
| `stream` | boolean | No | Stream response (default: true) |
| `temperature` | number | No | Sampling temperature |
| `top_p` | number | No | Nucleus sampling |
| `max_tokens` | number | No | Max tokens to generate |

*Either `prompt` or `messages` is required.

**Streaming Response (default):**
```
{"model":"llama3.2:1b","message":{"role":"assistant","content":"The"},"done":false}
{"model":"llama3.2:1b","message":{"role":"assistant","content":" capital"},"done":false}
{"model":"llama3.2:1b","message":{"role":"assistant","content":" of"},"done":false}
...
{"model":"llama3.2:1b","message":{"role":"assistant","content":""},"done":true}
{"sources":[{"id":"uuid-1","score":0.92,"content":"..."}]}
```

**Non-Streaming Response (`stream: false`):**
```json
{
  "success": true,
  "data": {
    "model": "llama3.2:1b",
    "message": {
      "role": "assistant",
      "content": "The capital of France is Paris."
    },
    "done": true,
    "sources": [
      {"id": "uuid-1", "score": 0.92, "content": "Paris is the capital..."}
    ]
  }
}
```

> **Note:** The `sources` field is only included when using RAG (i.e., when `collection` is specified).

---

### Direct LLM Access

Low-level endpoints for direct Ollama access without RAG features.

#### `POST /embed` — Create Embeddings

Generate embeddings for text.

```bash
curl -X POST http://localhost:3000/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "Text to embed"
  }'
```

**For multiple texts:**
```bash
curl -X POST http://localhost:3000/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": ["First text", "Second text"]
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Embedding model name |
| `input` | string or array | Yes | Text(s) to embed |

**Response:**
```json
{
  "success": true,
  "data": {
    "model": "nomic-embed-text",
    "embeddings": [[0.123, -0.456, ...]]
  }
}
```

#### `POST /generate` — Generate Text

Generate text from a prompt (completion-style).

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "Write a haiku about coding:"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model name |
| `prompt` | string | Yes | Input prompt |
| `system` | string | No | System prompt |
| `stream` | boolean | No | Stream response (default: true) |
| `options` | object | No | Model options (temperature, etc.) |

**Streaming Response (default):**
```
{"model":"llama3.2:1b","response":"Sil","done":false}
{"model":"llama3.2:1b","response":"ent","done":false}
...
{"model":"llama3.2:1b","response":"","done":true}
```

#### `POST /chat` — Chat Completion

Chat-style completion with message history.

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "messages": [
      {"role": "system", "content": "You are a pirate."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model name |
| `messages` | array | Yes | Array of message objects |
| `stream` | boolean | No | Stream response (default: true) |
| `options` | object | No | Model options |

**Message Object:**
| Field | Type | Description |
|-------|------|-------------|
| `role` | string | `system`, `user`, or `assistant` |
| `content` | string | Message content |

**Streaming Response:**
```
{"model":"llama3.2:1b","message":{"role":"assistant","content":"Ahoy"},"done":false}
{"model":"llama3.2:1b","message":{"role":"assistant","content":" there"},"done":false}
...
{"model":"llama3.2:1b","message":{"role":"assistant","content":""},"done":true}
```

---

## Response Format

All responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created (for POST operations that create resources) |
| 400 | Bad Request (missing or invalid parameters) |
| 401 | Unauthorized (missing or invalid auth token) |
| 404 | Not Found (collection, model, or document not found) |
| 405 | Method Not Allowed |
| 409 | Conflict (e.g., collection already exists) |
| 500 | Internal Server Error |

**Example Error Response:**
```json
{
  "success": false,
  "error": "Collection \"my-docs\" not found"
}
```

---

## Tips & Best Practices

1. **Model Auto-Pull:** Models are automatically pulled when first used — no need to manually download them.

2. **Embedding Model Choice:** Use `nomic-embed-text` for good general-purpose embeddings. It's lightweight and effective.

3. **Streaming:** Use streaming (default) for better UX in chat applications. Set `stream: false` only when you need the complete response at once.

4. **RAG Tuning:** Adjust `limit`/`top_k` and `score_threshold` to balance between context richness and relevance.

5. **Secure in Production:** Create an API token before exposing the API to any network. Once a token exists, all endpoints require authentication.

6. **Metadata:** Use document metadata for filtering searches. Store things like `source`, `category`, `date`, etc.

