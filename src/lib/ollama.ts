import type {
  OllamaGenerateRequest,
  OllamaChatRequest,
  OllamaEmbeddingRequest,
  OllamaEmbeddingResponse,
  OllamaModel,
} from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/**
 * Make a request to Ollama API
 */
async function ollamaRequest<T>(
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`${OLLAMA_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${error}`);
  }

  return response.json() as T;
}

// ============================================
// Models
// ============================================

export async function listModels(): Promise<OllamaModel[]> {
  const result = await ollamaRequest<{ models: OllamaModel[] }>('/api/tags');
  return result.models;
}

export async function showModel(name: string) {
  return ollamaRequest('/api/show', 'POST', { name });
}

/**
 * Check if a model is available locally
 */
export async function modelExists(name: string): Promise<boolean> {
  try {
    await showModel(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull a model and wait for completion (non-streaming)
 * Returns when the model is fully downloaded
 */
export async function pullModelSync(name: string): Promise<void> {
  const response = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: false }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to pull model "${name}": ${error}`);
  }
  
  // Wait for pull to complete
  await response.json();
}

/**
 * Pull a model (streaming) - returns stream of progress updates
 */
export async function pullModel(name: string): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to pull model: ${response.statusText}`);
  }

  return response.body;
}

export async function deleteModel(name: string) {
  return ollamaRequest('/api/delete', 'DELETE', { name });
}

export async function copyModel(source: string, destination: string) {
  return ollamaRequest('/api/copy', 'POST', { source, destination });
}

// ============================================
// Generation
// ============================================

export async function generate(request: OllamaGenerateRequest): Promise<Response> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, stream: request.stream ?? true }),
  });

  if (!response.ok) {
    throw new Error(`Ollama generate error: ${response.statusText}`);
  }

  return response;
}

export async function chat(request: OllamaChatRequest): Promise<Response> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, stream: request.stream ?? true }),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat error: ${response.statusText}`);
  }

  return response;
}

// ============================================
// Embeddings
// ============================================

export async function createEmbeddings(
  request: OllamaEmbeddingRequest
): Promise<OllamaEmbeddingResponse> {
  return ollamaRequest<OllamaEmbeddingResponse>('/api/embed', 'POST', request);
}

/**
 * Create embeddings for a single text
 */
export async function embed(model: string, text: string): Promise<number[]> {
  const result = await createEmbeddings({ model, input: text });
  const embedding = result.embeddings[0];
  if (!embedding) {
    throw new Error('No embedding returned from model');
  }
  return embedding;
}

/**
 * Create embeddings for multiple texts
 */
export async function embedBatch(model: string, texts: string[]): Promise<number[][]> {
  const result = await createEmbeddings({ model, input: texts });
  return result.embeddings;
}

// ============================================
// Proxy - for pass-through streaming requests
// ============================================

export async function proxyRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<Response> {
  const response = await fetch(`${OLLAMA_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

