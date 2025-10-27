/**
 * 缓存模块导出
 * 
 * 这个模块实现了类似 OpenNext 的多级缓存架构，
 * 使用阿里云 OSS 作为持久化存储，内存 LRU 缓存作为第一层缓存。
 * 
 * 架构说明：
 * 1. 第一层：内存 LRU 缓存
 *    - 最快的缓存层
 *    - 有过期时间（CACHE_LOCAL_TTL_MS）
 *    - 有大小限制（CACHE_LOCAL_MAX_SIZE）
 * 
 * 2. 第二层：阿里云 OSS
 *    - 持久化存储
 *    - 可跨实例共享
 *    - 较高的延迟但可靠性好
 * 
 * 使用方法：
 * 1. 在 next.config.ts 中配置 cacheHandler
 * 2. 设置环境变量
 * 3. Next.js 会自动使用这个缓存处理器
 */

const multiTierCache = require('./adapters/multi-tier-cache');
const threeTierCache = require('./adapters/multi-tier-with-metadata');
const ossCache = require('./adapters/oss-cache');
const { LRUCache } = require('./utils/lru');

module.exports = {
  multiTierCache,
  threeTierCache,
  ossCache,
  LRUCache,
};

