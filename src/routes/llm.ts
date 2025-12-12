import * as ollama from '../lib/ollama';
import type { APIResponse, OllamaGenerateRequest, OllamaChatRequest } from '../types';

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

/**
 * Handle direct LLM routes: /embed, /generate, /chat
 */
export async function handleLLMRoute(
  req: Request,
  path: string
): Promise<Response | null> {
  if (req.method !== 'POST') {
    return error('Method not allowed', 405);
  }

  // POST /embed - create embeddings
  if (path === '/embed') {
    try {
      const body = await req.json();
      if (!body.model || !body.input) {
        return error('model and input required');
      }
      
      // Auto-pull model if not available
      if (!(await ollama.modelExists(body.model))) {
        console.log(`Model "${body.model}" not found, pulling...`);
        await ollama.pullModelSync(body.model);
        console.log(`Model "${body.model}" pulled successfully`);
      }
      
      const result = await ollama.createEmbeddings(body);
      return json<APIResponse>({ success: true, data: result });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /generate - generate text (streaming by default)
  if (path === '/generate') {
    try {
      const body = (await req.json()) as OllamaGenerateRequest;
      if (!body.model || !body.prompt) {
        return error('model and prompt required');
      }
      
      // Auto-pull model if not available
      if (!(await ollama.modelExists(body.model))) {
        console.log(`Model "${body.model}" not found, pulling...`);
        await ollama.pullModelSync(body.model);
        console.log(`Model "${body.model}" pulled successfully`);
      }
      
      const response = await ollama.generate(body);
      
      // If streaming, pass through the stream with CORS headers
      // (streaming responses can't be wrapped by addCorsHeaders)
      if (body.stream !== false && response.body) {
        return new Response(response.body, {
          headers: { 
            'Content-Type': 'application/x-ndjson',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      
      // Otherwise return the JSON response
      const data = await response.json();
      return json<APIResponse>({ success: true, data });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /chat - chat completion (streaming by default)
  if (path === '/chat') {
    try {
      const body = (await req.json()) as OllamaChatRequest;
      if (!body.model || !body.messages) {
        return error('model and messages required');
      }
      
      // Auto-pull model if not available
      if (!(await ollama.modelExists(body.model))) {
        console.log(`Model "${body.model}" not found, pulling...`);
        await ollama.pullModelSync(body.model);
        console.log(`Model "${body.model}" pulled successfully`);
      }
      
      const response = await ollama.chat(body);
      
      // If streaming, pass through the stream with CORS headers
      // (streaming responses can't be wrapped by addCorsHeaders)
      if (body.stream !== false && response.body) {
        return new Response(response.body, {
          headers: { 
            'Content-Type': 'application/x-ndjson',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      
      // Otherwise return the JSON response
      const data = await response.json();
      return json<APIResponse>({ success: true, data });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  return null;
}

