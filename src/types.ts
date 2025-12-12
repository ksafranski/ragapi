// ============================================
// Configuration Types
// ============================================

export interface CollectionConfig {
  name: string;
  embeddingModel: string;
  dimension: number;
  createdAt: string;
}

export interface AppConfig {
  collections: Record<string, CollectionConfig>;
  apiTokens?: ApiToken[];  // Optional to maintain backwards compatibility
}

// ============================================
// Qdrant Types
// ============================================

export interface QdrantCollection {
  name: string;
  vectors_count?: number;
  points_count?: number;
  status?: string;
}

export interface QdrantPoint {
  id: string | number;
  vector?: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchParams {
  vector?: number[];
  limit?: number;
  filter?: Record<string, unknown>;
  with_payload?: boolean;
  with_vector?: boolean;
  score_threshold?: number;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  vector?: number[];
}

// ============================================
// Ollama Types
// ============================================

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaEmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface OllamaEmbeddingResponse {
  model: string;
  embeddings: number[][];
}

// ============================================
// RAG Types
// ============================================

export interface RAGDocument {
  id?: string | number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RAGInsertRequest {
  collection: string;
  documents: RAGDocument[];
}

export interface RAGSearchRequest {
  collection: string;
  query: string;
  limit?: number;
  filter?: Record<string, unknown>;
  score_threshold?: number;
}

export interface RAGSearchResult {
  id: string | number;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RAGQueryRequest {
  collection: string;
  query: string;
  model: string;
  limit?: number;
  system?: string;
  stream?: boolean;
}

// ============================================
// API Token Types
// ============================================

export interface ApiToken {
  id: string;
  name: string;
  tokenHash: string;  // SHA-256 hash of the token - can never be decrypted
  createdAt: string;
}

// What we return to clients (never expose the hash)
export interface ApiTokenInfo {
  id: string;
  name: string;
  createdAt: string;
}

// ============================================
// API Response Types
// ============================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

