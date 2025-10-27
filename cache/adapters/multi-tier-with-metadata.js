/**
 * 三级缓存适配器（带元数据层）
 * 类似 OpenNext 的完整多级缓存架构：
 * 1. 第一层：内存 LRU 缓存（最快，< 1ms）
 * 2. 第二层：表格存储元数据缓存（快速验证，5-10ms）
 * 3. 第三层：阿里云 OSS 持久化（完整数据，10-50ms）
 */
const { LRUCache } = require('../utils/lru');
const { debug, error: logError, warn } = require('../utils/logger');
const { IgnorableError } = require('../utils/errors');
const ossCache = require('./oss-cache');
const tablestoreMetadata = require('./tablestore-metadata');

// 本地缓存 TTL（毫秒）
const LOCAL_CACHE_TTL_MS = process.env.CACHE_LOCAL_TTL_MS
  ? parseInt(process.env.CACHE_LOCAL_TTL_MS, 10)
  : 60000; // 默认 60 秒

// 本地缓存最大条目数
const MAX_CACHE_SIZE = process.env.CACHE_LOCAL_MAX_SIZE
  ? parseInt(process.env.CACHE_LOCAL_MAX_SIZE, 10)
  : 1000;

// 创建本地 LRU 缓存实例
const localCache = new LRUCache(MAX_CACHE_SIZE);

// 检查是否配置了 OSS
const hasOSSConfig = !!(
  process.env.OSS_REGION &&
  process.env.OSS_ACCESS_KEY_ID &&
  process.env.OSS_ACCESS_KEY_SECRET &&
  process.env.OSS_BUCKET
);

// 检查是否配置了表格存储
const hasTableStoreConfig = !!(
  process.env.TABLESTORE_ENDPOINT &&
  process.env.TABLESTORE_INSTANCE &&
  process.env.TABLESTORE_ACCESS_KEY_ID &&
  process.env.TABLESTORE_ACCESS_KEY_SECRET
);

console.log('\n========== 缓存架构信息 ==========');
console.log(`📊 缓存层级: ${hasTableStoreConfig ? '3' : '2'} 层`);
console.log(`1️⃣  内存 LRU: ✅ (TTL: ${LOCAL_CACHE_TTL_MS}ms, Size: ${MAX_CACHE_SIZE})`);
if (hasTableStoreConfig) {
  console.log(`2️⃣  TableStore 元数据: ✅`);
}
console.log(`${hasTableStoreConfig ? '3️⃣' : '2️⃣'}  OSS 持久化: ${hasOSSConfig ? '✅' : '❌'}`);
console.log('=====================================\n');

/**
 * 三级缓存实现
 */
const multiTierCacheWithMetadata = {
  name: 'multi-tier-with-metadata',

  /**
   * 获取缓存
   */
  async get(key, cacheType = 'cache') {
    const now = Date.now();

    // ========================================
    // 第一层：内存 LRU 缓存
    // ========================================
    const localCacheEntry = localCache.get(key);
    
    if (localCacheEntry) {
      const age = now - localCacheEntry.lastModified;
      
      // 如果缓存未过期，直接返回
      if (age < LOCAL_CACHE_TTL_MS) {
        debug(`✨ [L1 HIT] 内存缓存（未过期）: ${key}, age: ${age}ms`);
        return {
          value: localCacheEntry.value,
          lastModified: localCacheEntry.lastModified,
        };
      }
      
      debug(`⏰ [L1 EXPIRED] 内存缓存已过期: ${key}, age: ${age}ms`);

      // ========================================
      // 第二层：表格存储元数据验证（如果配置）
      // ========================================
      if (hasTableStoreConfig) {
        try {
          const metadata = await tablestoreMetadata.getMeta(key);
          
          if (metadata) {
            // 检查是否被标记删除
            if (metadata.deleted) {
              debug(`🗑️  [L2 DELETED] 缓存已删除: ${key}`);
              localCache.delete(key);
              return null;
            }

            // 如果元数据的 revalidatedAt <= 内存缓存的 lastModified
            // 说明缓存仍然有效，继续使用内存缓存
            if (metadata.revalidatedAt <= localCacheEntry.lastModified) {
              debug(`✨ [L2 VALID] 元数据验证通过，使用内存缓存: ${key}`);
              debug(`   元数据时间: ${metadata.revalidatedAt}, 缓存时间: ${localCacheEntry.lastModified}`);
              
              return {
                value: localCacheEntry.value,
                lastModified: localCacheEntry.lastModified,
              };
            }

            debug(`🔄 [L2 STALE] 元数据显示缓存已过期: ${key}`);
          } else {
            debug(`❓ [L2 MISS] 元数据不存在: ${key}`);
          }
        } catch (err) {
          warn(`⚠️  [L2 ERROR] 元数据查询失败，降级到 OSS: ${key}`, err);
        }
      }
    }

    // ========================================
    // 第三层：OSS 持久化缓存
    // ========================================
    if (hasOSSConfig) {
      try {
        debug(`🔍 [L3 QUERY] 从 OSS 获取: ${key}`);
        const ossResult = await ossCache.get(key, cacheType);
        
        if (ossResult?.value) {
          // 更新内存缓存
          localCache.set(key, {
            value: ossResult.value,
            lastModified: ossResult.lastModified,
          });

          // 更新元数据（如果配置）
          if (hasTableStoreConfig) {
            await tablestoreMetadata.setMeta(key, {
              lastModified: ossResult.lastModified,
              revalidatedAt: ossResult.lastModified,
              deleted: false,
              size: JSON.stringify(ossResult.value).length,
            }).catch(err => {
              warn(`元数据更新失败: ${key}`, err);
            });
          }
          
          debug(`✅ [L3 HIT] 成功从 OSS 获取并更新缓存: ${key}`);
          return ossResult;
        }
        
        debug(`❌ [L3 MISS] OSS 缓存不存在: ${key}`);
        return null;
      } catch (err) {
        // 如果是可忽略的错误（如缓存不存在），返回 null
        if (err instanceof IgnorableError) {
          debug(`❌ [L3 MISS] OSS 缓存不存在: ${key}`);
          return null;
        }
        
        // 其他错误记录日志
        logError(`⚠️  [L3 ERROR] OSS 获取失败: ${key}`, err);
        
        // 降级策略：如果有内存缓存，即使过期也返回
        if (localCacheEntry) {
          warn(`⚠️  [FALLBACK] 使用过期的内存缓存: ${key}`);
          return {
            value: localCacheEntry.value,
            lastModified: localCacheEntry.lastModified,
          };
        }
        
        return null;
      }
    }
    
    // 没有 OSS 配置，只使用内存缓存
    debug(`❌ [MISS] 所有缓存层都未命中: ${key}`);
    return null;
  },

  /**
   * 设置缓存
   */
  async set(key, value, cacheType = 'cache') {
    const now = Date.now();
    const size = JSON.stringify(value).length;
    
    debug(`💾 [SET] 设置缓存: ${key}, 大小: ${size} bytes`);

    // 写入 OSS（如果配置）
    if (hasOSSConfig) {
      try {
        await ossCache.set(key, value, cacheType);
        debug(`✅ [L3 SET] OSS 写入成功: ${key}`);
      } catch (err) {
        logError(`⚠️  [L3 ERROR] OSS 写入失败: ${key}`, err);
      }
    }

    // 更新元数据（如果配置）
    if (hasTableStoreConfig) {
      try {
        await tablestoreMetadata.setMeta(key, {
          lastModified: now,
          revalidatedAt: now,
          deleted: false,
          size,
        });
        debug(`✅ [L2 SET] 元数据写入成功: ${key}`);
      } catch (err) {
        warn(`⚠️  [L2 ERROR] 元数据写入失败: ${key}`, err);
      }
    }

    // 更新内存缓存
    localCache.set(key, {
      value,
      lastModified: now,
    });
    debug(`✅ [L1 SET] 内存缓存更新: ${key}`);
  },

  /**
   * 删除缓存
   */
  async delete(key) {
    const now = Date.now();
    debug(`🗑️  [DELETE] 删除缓存: ${key}`);

    // 从 OSS 删除（如果配置）
    if (hasOSSConfig) {
      try {
        await ossCache.delete(key);
        debug(`✅ [L3 DELETE] OSS 删除成功: ${key}`);
      } catch (err) {
        warn(`⚠️  [L3 ERROR] OSS 删除失败: ${key}`, err);
      }
    }

    // 更新元数据标记为已删除（如果配置）
    if (hasTableStoreConfig) {
      try {
        await tablestoreMetadata.deleteMeta(key);
        debug(`✅ [L2 DELETE] 元数据标记删除: ${key}`);
      } catch (err) {
        warn(`⚠️  [L2 ERROR] 元数据删除失败: ${key}`, err);
      }
    }

    // 从内存缓存删除
    localCache.delete(key);
    debug(`✅ [L1 DELETE] 内存缓存删除: ${key}`);
  },

  /**
   * 统计信息（可选，用于监控）
   */
  getStats() {
    return {
      cacheSize: localCache.size(),
      maxSize: MAX_CACHE_SIZE,
      ttl: LOCAL_CACHE_TTL_MS,
      hasTableStore: hasTableStoreConfig,
      hasOSS: hasOSSConfig,
    };
  },
};

module.exports = multiTierCacheWithMetadata;

