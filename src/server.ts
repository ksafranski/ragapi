import { handleCollectionsRoute } from './routes/collections';
import { handleModelsRoute } from './routes/models';
import { handleQueryRoute } from './routes/query';
import { handleLLMRoute } from './routes/llm';
import { handleApiTokensRoute } from './routes/api-tokens';
import * as tokens from './lib/tokens';

const PORT = parseInt(process.env.PORT || '3000');

function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

const server = Bun.serve({
  port: PORT,
  
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers for development
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Auth middleware - check bearer token if any tokens exist
    const hasTokens = await tokens.hasApiTokens();
    if (hasTokens) {
      const authHeader = req.headers.get('Authorization');
      
      // Allow /api-tokens route without auth for managing tokens
      // (you need at least one valid token to manage them)
      const isApiTokensRoute = path.startsWith('/api-tokens');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // If managing api-tokens, still require auth
        if (isApiTokensRoute || path !== '/health') {
          return json({ success: false, error: 'Authorization header with Bearer token required' }, 401);
        }
      } else {
        const bearerToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const isValid = await tokens.validateBearerToken(bearerToken);
        
        if (!isValid) {
          return json({ success: false, error: 'Invalid bearer token' }, 401);
        }
      }
    }

    // Health check
    if (path === '/health' || path === '/') {
      return json({
        status: 'ok',
        version: '1.0.0',
        authEnabled: await tokens.hasApiTokens(),
        endpoints: {
          apiTokens: '/api-tokens',
          collections: '/collections',
          models: '/models',
          query: '/query',
          embed: '/embed',
          generate: '/generate',
          chat: '/chat',
        },
      });
    }

    // Route to appropriate handler
    try {
      let response: Response | null = null;

      // API Tokens routes
      if (path.startsWith('/api-tokens')) {
        response = await handleApiTokensRoute(req, path);
      }
      // Collections routes
      else if (path.startsWith('/collections')) {
        response = await handleCollectionsRoute(req, path);
      }
      // Models routes
      else if (path.startsWith('/models')) {
        response = await handleModelsRoute(req, path);
      }
      // Query route
      else if (path === '/query') {
        response = await handleQueryRoute(req);
      }
      // LLM routes (embed, generate, chat)
      else if (path === '/embed' || path === '/generate' || path === '/chat') {
        response = await handleLLMRoute(req, path);
      }

      if (response) return response;

      // 404
      return json({ success: false, error: 'Not found' }, 404);
    } catch (e) {
      console.error('Server error:', e);
      return json({ success: false, error: String(e) }, 500);
    }
  },

  error(error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

console.log(`
🚀 RAG API Server running on http://localhost:${PORT}

Endpoints:

  🔐 API Tokens (auth required when tokens exist)
  ├── GET    /api-tokens                       - List all tokens
  ├── POST   /api-tokens                       - Create token (returns token once!)
  ├── GET    /api-tokens/:id                   - Get token details
  └── DELETE /api-tokens/:id                   - Delete token
  
  📚 Collections
  ├── GET    /collections                      - List all collections
  ├── POST   /collections                      - Create collection (with embedding model)
  ├── GET    /collections/:name                - Get collection details
  ├── DELETE /collections/:name                - Delete collection
  ├── POST   /collections/:name/documents      - Insert documents (auto-embed)
  ├── GET    /collections/:name/documents      - List documents
  ├── POST   /collections/:name/search         - Search (auto-embed query)
  └── DELETE /collections/:name/documents      - Delete documents by ID

  🤖 Models
  ├── GET    /models                           - List all models
  ├── GET    /models/:name                     - Get model details
  ├── POST   /models/pull                      - Pull a model (streaming)
  ├── POST   /models/copy                      - Copy a model
  └── DELETE /models/:name                     - Delete a model

  🔮 Query
  └── POST   /query                            - Query (with or without RAG context)

  ⚡ LLM Direct
  ├── POST   /embed                            - Create embeddings
  ├── POST   /generate                         - Generate text (streaming)
  └── POST   /chat                             - Chat completion (streaming)

  💚 Health
  └── GET    /health                           - Health check

  Note: When API tokens exist, all endpoints (except /health) require
        Authorization: Bearer <token> header.
`);

// Don't export - causes double initialization issues with Bun
// export default server;
