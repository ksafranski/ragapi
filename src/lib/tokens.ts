import type { ApiToken, ApiTokenInfo } from '../types';
import { loadConfig, saveConfig } from './config';

/**
 * Generate a cryptographically secure alphanumeric token
 * 75 characters, only a-z, A-Z, 0-9
 */
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const tokenLength = 75;
  
  // Use crypto.getRandomValues for secure random generation
  const randomBytes = new Uint8Array(tokenLength);
  crypto.getRandomValues(randomBytes);
  
  let token = '';
  for (let i = 0; i < tokenLength; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  
  return token;
}

/**
 * Hash a token using SHA-256
 * This is a one-way hash - the original token cannot be recovered
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a token against a stored hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  return tokenHash === hash;
}

/**
 * Get all API tokens (returns info only, not hashes)
 */
export async function listApiTokens(): Promise<ApiTokenInfo[]> {
  const config = await loadConfig();
  const tokens = config.apiTokens || [];
  
  // Return only the safe info (no hashes)
  return tokens.map(t => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
  }));
}

/**
 * Get all API tokens with hashes (internal use only)
 */
export async function getApiTokensWithHashes(): Promise<ApiToken[]> {
  const config = await loadConfig();
  return config.apiTokens || [];
}

/**
 * Check if any API tokens exist
 */
export async function hasApiTokens(): Promise<boolean> {
  const config = await loadConfig();
  return (config.apiTokens?.length || 0) > 0;
}

/**
 * Create a new API token
 * Returns the plaintext token (only time it's ever visible)
 */
export async function createApiToken(name: string): Promise<{ token: string; info: ApiTokenInfo }> {
  const config = await loadConfig();
  
  if (!config.apiTokens) {
    config.apiTokens = [];
  }
  
  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);
  
  const newToken: ApiToken = {
    id: crypto.randomUUID(),
    name,
    tokenHash,
    createdAt: new Date().toISOString(),
  };
  
  config.apiTokens.push(newToken);
  await saveConfig(config);
  
  return {
    token: plainToken,  // Only returned once!
    info: {
      id: newToken.id,
      name: newToken.name,
      createdAt: newToken.createdAt,
    },
  };
}

/**
 * Delete an API token by ID
 */
export async function deleteApiToken(id: string): Promise<boolean> {
  const config = await loadConfig();
  
  if (!config.apiTokens) {
    return false;
  }
  
  const initialLength = config.apiTokens.length;
  config.apiTokens = config.apiTokens.filter(t => t.id !== id);
  
  if (config.apiTokens.length === initialLength) {
    return false;  // Token not found
  }
  
  await saveConfig(config);
  return true;
}

/**
 * Validate a bearer token against stored tokens
 */
export async function validateBearerToken(bearerToken: string): Promise<boolean> {
  const tokens = await getApiTokensWithHashes();
  
  for (const token of tokens) {
    if (await verifyToken(bearerToken, token.tokenHash)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get API token by ID (returns info only, not hash)
 */
export async function getApiToken(id: string): Promise<ApiTokenInfo | null> {
  const config = await loadConfig();
  const token = config.apiTokens?.find(t => t.id === id);
  
  if (!token) {
    return null;
  }
  
  return {
    id: token.id,
    name: token.name,
    createdAt: token.createdAt,
  };
}

