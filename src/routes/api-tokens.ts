import * as tokens from '../lib/tokens';
import type { APIResponse, ApiTokenInfo } from '../types';

interface CreateTokenBody {
  name: string;
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

/**
 * Handle API tokens routes
 * 
 * GET    /api-tokens      - List all tokens (name, id, createdAt only)
 * POST   /api-tokens      - Create a new token (returns plaintext token ONCE)
 * GET    /api-tokens/:id  - Get token details
 * DELETE /api-tokens/:id  - Delete a token
 */
export async function handleApiTokensRoute(
  req: Request,
  path: string
): Promise<Response | null> {
  const method = req.method;

  // GET /api-tokens - list all tokens
  if (path === '/api-tokens' && method === 'GET') {
    try {
      const tokenList = await tokens.listApiTokens();
      return json<APIResponse<ApiTokenInfo[]>>({ 
        success: true, 
        data: tokenList,
      });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // POST /api-tokens - create new token
  if (path === '/api-tokens' && method === 'POST') {
    try {
      const body = (await req.json()) as CreateTokenBody;
      
      if (!body.name || typeof body.name !== 'string') {
        return error('name is required');
      }
      
      if (body.name.trim().length === 0) {
        return error('name cannot be empty');
      }
      
      const result = await tokens.createApiToken(body.name.trim());
      
      return json<APIResponse<{
        id: string;
        name: string;
        createdAt: string;
        token: string;  // Only returned on creation!
      }>>({ 
        success: true, 
        data: {
          ...result.info,
          token: result.token,
        },
      }, 201);
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // Match /api-tokens/:id pattern
  const tokenMatch = path.match(/^\/api-tokens\/([^\/]+)$/);

  // GET /api-tokens/:id - get token details
  if (tokenMatch?.[1] && method === 'GET') {
    try {
      const id = tokenMatch[1];
      const token = await tokens.getApiToken(id);
      
      if (!token) {
        return error(`Token not found`, 404);
      }
      
      return json<APIResponse<ApiTokenInfo>>({ success: true, data: token });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  // DELETE /api-tokens/:id - delete token
  if (tokenMatch?.[1] && method === 'DELETE') {
    try {
      const id = tokenMatch[1];
      const deleted = await tokens.deleteApiToken(id);
      
      if (!deleted) {
        return error(`Token not found`, 404);
      }
      
      return json<APIResponse>({ success: true });
    } catch (e) {
      return error(String(e), 500);
    }
  }

  return null;
}

