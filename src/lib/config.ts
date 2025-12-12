import type { AppConfig, CollectionConfig } from '../types';

const CONFIG_PATH = './config.json';

const defaultConfig: AppConfig = {
  collections: {},
};

/**
 * Load config from JSON file
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      return await file.json();
    }
    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

/**
 * Save config to JSON file
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Get collection config by name
 */
export async function getCollectionConfig(name: string): Promise<CollectionConfig | null> {
  const config = await loadConfig();
  return config.collections[name] || null;
}

/**
 * Set collection config
 */
export async function setCollectionConfig(collection: CollectionConfig): Promise<void> {
  const config = await loadConfig();
  config.collections[collection.name] = collection;
  await saveConfig(config);
}

/**
 * Remove collection config
 */
export async function removeCollectionConfig(name: string): Promise<void> {
  const config = await loadConfig();
  delete config.collections[name];
  await saveConfig(config);
}

/**
 * List all collection configs
 */
export async function listCollectionConfigs(): Promise<CollectionConfig[]> {
  const config = await loadConfig();
  return Object.values(config.collections);
}

