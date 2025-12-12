import * as ollama from '../lib/ollama';
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

/**
 * Handle model routes
 */
export async function handleModelsRoute(
  req: Request,
  path: string
): Promise<Response | null> {
  const method = req.method;

  // GET /models - list all models
  if (path === '/models' && method === 'GET') {
    try {
      const models = await ollama.listModels();
      return json<APIResponse>({ success: true, data: models });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /models/pull - pull a model (streaming)
  if (path === '/models/pull' && method === 'POST') {
    try {
      const body = await req.json();
      if (!body.name) {
        return error('name required');
      }
      
      const stream = await ollama.pullModel(body.name);
      // Return streaming response with CORS headers included
      // (streaming responses can't be wrapped by addCorsHeaders)
      return new Response(stream, {
        headers: { 
          'Content-Type': 'application/x-ndjson',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /models/copy - copy a model
  if (path === '/models/copy' && method === 'POST') {
    try {
      const body = await req.json();
      if (!body.source || !body.destination) {
        return error('source and destination required');
      }
      
      await ollama.copyModel(body.source, body.destination);
      return json<APIResponse>({ success: true });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // Match /models/:name
  const modelMatch = path.match(/^\/models\/(.+)$/);

  // GET /models/:name - get model details
  if (modelMatch && method === 'GET') {
    try {
      const name = decodeURIComponent(modelMatch[1]);
      const model = await ollama.showModel(name);
      return json<APIResponse>({ success: true, data: model });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // DELETE /models/:name - delete a model
  if (modelMatch && method === 'DELETE') {
    try {
      const name = decodeURIComponent(modelMatch[1]);
      await ollama.deleteModel(name);
      return json<APIResponse>({ success: true });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  return null;
}

