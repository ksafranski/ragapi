import type { QdrantPoint, QdrantSearchParams, QdrantSearchResult } from '../types';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

/**
 * Make a request to Qdrant API
 */
async function qdrantRequest<T>(
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Qdrant error: ${response.status} - ${error}`);
  }

  return response.json() as T;
}

// ============================================
// Collections
// ============================================

export async function listCollections() {
  const result = await qdrantRequest<{ result: { collections: Array<{ name: string }> } }>(
    '/collections'
  );
  return result.result.collections;
}

export async function getCollection(name: string) {
  const result = await qdrantRequest<{ result: unknown }>(`/collections/${name}`);
  return result.result;
}

export async function createCollection(
  name: string,
  dimension: number,
  distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
) {
  return qdrantRequest(`/collections/${name}`, 'PUT', {
    vectors: {
      size: dimension,
      distance,
    },
  });
}

export async function deleteCollection(name: string) {
  return qdrantRequest(`/collections/${name}`, 'DELETE');
}

export async function collectionExists(name: string): Promise<boolean> {
  try {
    await getCollection(name);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Points
// ============================================

export async function upsertPoints(collection: string, points: QdrantPoint[]) {
  return qdrantRequest(`/collections/${collection}/points`, 'PUT', {
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  });
}

export async function getPoints(collection: string, ids: (string | number)[]) {
  const result = await qdrantRequest<{ result: QdrantPoint[] }>(
    `/collections/${collection}/points`,
    'POST',
    { ids, with_payload: true, with_vector: true }
  );
  return result.result;
}

export async function deletePoints(collection: string, ids: (string | number)[]) {
  return qdrantRequest(`/collections/${collection}/points/delete`, 'POST', {
    points: ids,
  });
}

export async function scrollPoints(
  collection: string,
  limit: number = 10,
  offset?: string | number,
  filter?: Record<string, unknown>
) {
  const result = await qdrantRequest<{
    result: { points: QdrantPoint[]; next_page_offset?: string | number };
  }>(`/collections/${collection}/points/scroll`, 'POST', {
    limit,
    offset,
    filter,
    with_payload: true,
    with_vector: false,
  });
  return result.result;
}

// ============================================
// Search
// ============================================

export async function searchPoints(
  collection: string,
  params: QdrantSearchParams
): Promise<QdrantSearchResult[]> {
  const result = await qdrantRequest<{ result: QdrantSearchResult[] }>(
    `/collections/${collection}/points/search`,
    'POST',
    {
      vector: params.vector,
      limit: params.limit || 10,
      filter: params.filter,
      with_payload: params.with_payload ?? true,
      with_vector: params.with_vector ?? false,
      score_threshold: params.score_threshold,
    }
  );
  return result.result;
}

// ============================================
// Proxy - for pass-through requests
// ============================================

export async function proxyRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<Response> {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

