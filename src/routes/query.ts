import * as qdrant from '../lib/qdrant';
import * as ollama from '../lib/ollama';
import * as config from '../lib/config';
import type { APIResponse } from '../types';

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

interface QueryRequest {
  model: string;
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  // RAG options (optional)
  collection?: string;
  query?: string;
  limit?: number;
  top_k?: number;  // Alias for limit (RAG search)
  score_threshold?: number;
  // LLM options
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

/**
 * Handle /query route
 * 
 * This is the unified query endpoint that can:
 * 1. Just prompt a model directly (no collection)
 * 2. Do RAG by searching a collection and using results as context
 */
export async function handleQueryRoute(req: Request): Promise<Response | null> {
  if (req.method !== 'POST') {
    return error('Method not allowed', 405);
  }

  try {
    const body = (await req.json()) as QueryRequest;
    
    if (!body.model) {
      return error('model required');
    }

    // Determine query text - could be prompt, query, or last user message
    const queryText = body.query || body.prompt || 
      body.messages?.filter(m => m.role === 'user').pop()?.content;

    if (!queryText && !body.messages?.length) {
      return error('prompt, query, or messages required');
    }

    // Auto-pull chat model if not available
    const chatModelAvailable = await ollama.modelExists(body.model);
    if (!chatModelAvailable) {
      console.log(`Model "${body.model}" not found, pulling...`);
      try {
        await ollama.pullModelSync(body.model);
        console.log(`Model "${body.model}" pulled successfully`);
      } catch (pullError) {
        return error(`Model "${body.model}" not found and failed to pull: ${pullError}`, 400);
      }
    }

    // If collection specified, do RAG
    let context = '';
    let sources: Array<{ id: string | number; score: number; content: string }> = [];

    if (body.collection) {
      const cfg = await config.getCollectionConfig(body.collection);
      if (!cfg) {
        return error(`Collection "${body.collection}" not found`, 404);
      }

      // Search for relevant documents (top_k is alias for limit)
      const queryEmbedding = await ollama.embed(cfg.embeddingModel, queryText!);
      const searchResults = await qdrant.searchPoints(body.collection, {
        vector: queryEmbedding,
        limit: body.top_k || body.limit || 5,
        with_payload: true,
        score_threshold: body.score_threshold,
      });

      // Build context from search results
      context = searchResults
        .map((r, i) => `[${i + 1}] ${r.payload?.content || ''}`)
        .join('\n\n');

      sources = searchResults.map((r) => ({
        id: r.id,
        score: r.score,
        content: (r.payload?.content as string) || '',
      }));
    }

    // Build messages for chat
    const systemPrompt = body.system || (body.collection
      ? 'You are a helpful assistant. Answer the question based on the provided context. If the context doesn\'t contain relevant information, say so.'
      : 'You are a helpful assistant.');

    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

    if (body.messages) {
      // User provided messages - inject context into system or first user message
      messages = [...body.messages];
      if (context) {
        const systemIdx = messages.findIndex(m => m.role === 'system');
        if (systemIdx >= 0) {
          messages[systemIdx] = {
            ...messages[systemIdx],
            content: `${messages[systemIdx].content}\n\nContext:\n${context}`,
          };
        } else {
          messages.unshift({ role: 'system', content: `${systemPrompt}\n\nContext:\n${context}` });
        }
      }
    } else {
      // Simple prompt mode
      const userContent = context 
        ? `Context:\n${context}\n\nQuestion: ${queryText}`
        : queryText!;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];
    }

    // Build LLM options
    const options: Record<string, unknown> = {};
    if (body.temperature !== undefined) options.temperature = body.temperature;
    if (body.top_p !== undefined) options.top_p = body.top_p;
    if (body.max_tokens !== undefined) options.num_predict = body.max_tokens;

    // Generate response
    const response = await ollama.chat({
      model: body.model,
      messages,
      stream: body.stream !== false,
      options: Object.keys(options).length > 0 ? options : undefined,
    });

    // If streaming, pass through with sources appended at end
    if (body.stream !== false && response.body) {
      // If we have sources, append them at the end
      if (sources.length > 0) {
        const encoder = new TextEncoder();
        const sourcesLine = JSON.stringify({ sources }) + '\n';
        
        const transformedStream = new ReadableStream({
          async start(controller) {
            const reader = response.body!.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.enqueue(encoder.encode(sourcesLine));
                  controller.close();
                  break;
                }
                controller.enqueue(value);
              }
            } catch (e) {
              controller.error(e);
            }
          },
        });

        return new Response(transformedStream, {
          headers: { 'Content-Type': 'application/x-ndjson' },
        });
      }

      return new Response(response.body, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      });
    }

    // Non-streaming response
    const data = await response.json();
    const result: Record<string, unknown> = { ...data };
    if (sources.length > 0) {
      result.sources = sources;
    }
    
    return json<APIResponse>({ success: true, data: result });
  } catch (e) {
    return error(String(e), 500);
  }
}

