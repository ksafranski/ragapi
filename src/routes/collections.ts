import * as qdrant from '../lib/qdrant';
import * as ollama from '../lib/ollama';
import * as config from '../lib/config';
import type { APIResponse, CollectionConfig, RAGDocument } from '../types';

// Request body types
interface CreateCollectionBody {
  name: string;
  embeddingModel: string;
  dimension?: number;
  distance?: 'Cosine' | 'Euclid' | 'Dot';
}

interface InsertDocumentsBody {
  documents?: RAGDocument[];
  content?: string;
  metadata?: Record<string, unknown>;
}

interface DeleteDocumentsBody {
  ids: (string | number)[];
}

interface SearchBody {
  query: string;
  limit?: number;
  top_k?: number;  // Alias for limit (common LLM terminology)
  filter?: Record<string, unknown>;
  score_threshold?: number;
}

function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function error(message: string, status = 400): Response {
  return json<APIResponse>({ success: false, error: message }, status);
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Handle collection routes
 */
export async function handleCollectionsRoute(
  req: Request,
  path: string
): Promise<Response | null> {
  const method = req.method;

  // GET /collections - list all collections
  if (path === '/collections' && method === 'GET') {
    try {
      const configs = await config.listCollectionConfigs();
      return json<APIResponse>({ success: true, data: configs });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /collections - create collection with embedding model
  if (path === '/collections' && method === 'POST') {
    try {
      const body = (await req.json()) as CreateCollectionBody;
      
      if (!body.name) {
        return error('name required');
      }
      if (!body.embeddingModel) {
        return error('embeddingModel required');
      }

      // Get embedding dimension by creating a test embedding
      let dimension = body.dimension;
      if (!dimension) {
        // Check if model exists, auto-pull if not
        const modelAvailable = await ollama.modelExists(body.embeddingModel);
        if (!modelAvailable) {
          console.log(`Model "${body.embeddingModel}" not found, pulling...`);
          try {
            await ollama.pullModelSync(body.embeddingModel);
            console.log(`Model "${body.embeddingModel}" pulled successfully`);
          } catch (pullError) {
            return error(`Model "${body.embeddingModel}" not found and failed to pull: ${pullError}`, 400);
          }
        }
        
        try {
          const testEmbedding = await ollama.embed(body.embeddingModel, 'test');
          dimension = testEmbedding.length;
        } catch (e) {
          return error(`Failed to get embedding dimension from "${body.embeddingModel}": ${e}`, 400);
        }
      }

      // Check if collection already exists
      const exists = await qdrant.collectionExists(body.name);
      if (exists) {
        return error(`Collection "${body.name}" already exists`, 409);
      }

      // Create collection in Qdrant
      await qdrant.createCollection(body.name, dimension, body.distance || 'Cosine');

      // Save config
      const collectionConfig: CollectionConfig = {
        name: body.name,
        embeddingModel: body.embeddingModel,
        dimension,
        createdAt: new Date().toISOString(),
      };
      await config.setCollectionConfig(collectionConfig);

      return json<APIResponse>({ success: true, data: collectionConfig }, 201);
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // Match /collections/:name patterns
  const collectionMatch = path.match(/^\/collections\/([^\/]+)$/);
  const documentsMatch = path.match(/^\/collections\/([^\/]+)\/documents$/);
  const searchMatch = path.match(/^\/collections\/([^\/]+)\/search$/);

  // GET /collections/:name - get collection details
  if (collectionMatch?.[1] && method === 'GET') {
    try {
      const name = collectionMatch[1];
      const cfg = await config.getCollectionConfig(name);
      
      if (!cfg) {
        return error(`Collection "${name}" not found`, 404);
      }
      
      const collection = await qdrant.getCollection(name);
      return json<APIResponse>({
        success: true,
        data: { ...cfg, qdrant: collection },
      });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // DELETE /collections/:name - delete collection
  if (collectionMatch?.[1] && method === 'DELETE') {
    try {
      const name = collectionMatch[1];
      await qdrant.deleteCollection(name);
      await config.removeCollectionConfig(name);
      return json<APIResponse>({ success: true });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /collections/:name/documents - insert documents (auto-embed)
  if (documentsMatch?.[1] && method === 'POST') {
    try {
      const collectionName = documentsMatch[1];
      const body = (await req.json()) as InsertDocumentsBody;
      
      // Support both { documents: [...] } and single document { content: "..." }
      const documents: RAGDocument[] = body.documents || (body.content ? [body as RAGDocument] : []);
      if (!documents.length) {
        return error('documents required');
      }

      // Get collection config to find embedding model
      const cfg = await config.getCollectionConfig(collectionName);
      if (!cfg) {
        return error(`Collection "${collectionName}" not found. Create it first.`, 404);
      }

      // Generate embeddings for all documents
      const contents = documents.map((d) => d.content);
      const embeddings = await ollama.embedBatch(cfg.embeddingModel, contents);

      // Create points for Qdrant
      const points = documents.map((doc, i) => ({
        id: doc.id || generateId(),
        vector: embeddings[i],
        payload: {
          content: doc.content,
          ...doc.metadata,
        },
      }));

      // Upsert to Qdrant
      await qdrant.upsertPoints(collectionName, points);

      return json<APIResponse>({
        success: true,
        data: {
          inserted: points.length,
          ids: points.map((p) => p.id),
        },
      });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // GET /collections/:name/documents - list documents
  if (documentsMatch?.[1] && method === 'GET') {
    try {
      const collectionName = documentsMatch[1];
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = url.searchParams.get('offset') || undefined;

      const result = await qdrant.scrollPoints(collectionName, limit, offset);
      return json<APIResponse>({ success: true, data: result });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // DELETE /collections/:name/documents - delete documents by ID
  if (documentsMatch?.[1] && method === 'DELETE') {
    try {
      const collectionName = documentsMatch[1];
      const body = (await req.json()) as DeleteDocumentsBody;
      
      if (!body.ids || !Array.isArray(body.ids)) {
        return error('ids array required');
      }

      await qdrant.deletePoints(collectionName, body.ids);
      return json<APIResponse>({ success: true });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /collections/:name/search - search (auto-embed query)
  if (searchMatch?.[1] && method === 'POST') {
    try {
      const collectionName = searchMatch[1];
      const body = (await req.json()) as SearchBody;
      
      if (!body.query) {
        return error('query required');
      }

      // Get collection config to find embedding model
      const cfg = await config.getCollectionConfig(collectionName);
      if (!cfg) {
        return error(`Collection "${collectionName}" not found`, 404);
      }

      // Generate embedding for query
      const queryEmbedding = await ollama.embed(cfg.embeddingModel, body.query);

      // Search Qdrant (top_k is alias for limit)
      const results = await qdrant.searchPoints(collectionName, {
        vector: queryEmbedding,
        limit: body.top_k || body.limit || 10,
        filter: body.filter,
        with_payload: true,
        score_threshold: body.score_threshold,
      });

      // Format results
      const formattedResults = results.map((r) => ({
        id: r.id,
        content: (r.payload?.content as string) || '',
        score: r.score,
        metadata: Object.fromEntries(
          Object.entries(r.payload || {}).filter(([k]) => k !== 'content')
        ),
      }));

      return json<APIResponse>({ success: true, data: formattedResults });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  return null;
}
