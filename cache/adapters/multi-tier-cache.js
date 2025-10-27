/**
 * 多级缓存适配器
 * 实现类似 OpenNext 的多级缓存架构：
 * 1. 第一层：内存 LRU 缓存（最快）
 * 2. 第二层：阿里云 OSS（持久化）
 */
const { LRUCache } = require('../utils/lru');
const { debug, error: logError, warn } = require('../utils/logger');
const { IgnorableError } = require('../utils/errors');

// 检查是否配置了 OSS
const hasOSSConfig = !!(
  process.env.OSS_REGION &&
  process.env.OSS_ACCESS_KEY_ID &&
  process.env.OSS_ACCESS_KEY_SECRET &&
  process.env.OSS_BUCKET
);

let ossCache = null;
if (hasOSSConfig) {
  try {
    ossCache = require('./oss-cache');
    console.log('✅ OSS 缓存已启用');
    console.log(`📦 Bucket: ${process.env.OSS_BUCKET}`);
    console.log(`🌍 Region: ${process.env.OSS_REGION}`);
    console.log(`📁 Prefix: ${process.env.OSS_CACHE_PREFIX || 'cache/'}`);
  } catch (err) {
    warn('OSS 缓存初始化失败，将只使用内存缓存', err);
  }
} else {
  console.log('⚠️  未配置 OSS，仅使用内存缓存（性能较低）');
  console.log('💡 提示：在 .env.local 中配置以下环境变量启用 OSS：');
  console.log('   - OSS_REGION');
  console.log('   - OSS_ACCESS_KEY_ID');
  console.log('   - OSS_ACCESS_KEY_SECRET');
  console.log('   - OSS_BUCKET');
}

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

/**
 * 多级缓存实现
 * 
 * 读取流程：
 * 1. 首先检查内存 LRU 缓存
 * 2. 如果内存缓存存在且未过期，直接返回
 * 3. 如果内存缓存过期或不存在，从 OSS 获取
 * 4. 将从 OSS 获取的数据更新到内存缓存
 * 
 * 写入流程：
 * 1. 先写入 OSS（持久化）
 * 2. 然后更新内存 LRU 缓存
 */
const multiTierCache = {
  name: 'multi-tier-oss',

  /**
   * 获取缓存
   */
  async get(key, cacheType = 'cache') {
    // 第一层：检查内存缓存
    const localCacheEntry = localCache.get(key);
    
    if (localCacheEntry) {
      const now = Date.now();
      const age = now - localCacheEntry.lastModified;
      
      // 如果缓存未过期，直接返回
      if (age < LOCAL_CACHE_TTL_MS) {
        debug(`使用内存缓存（未过期）: ${key}, age: ${age}ms`);
        return {
          value: localCacheEntry.value,
          lastModified: localCacheEntry.lastModified,
        };
      }
      
      debug(`内存缓存已过期: ${key}, age: ${age}ms, TTL: ${LOCAL_CACHE_TTL_MS}ms`);
    }

    // 第二层：从 OSS 获取（如果已配置）
    if (ossCache) {
      try {
        debug(`从 OSS 获取缓存: ${key}`);
        const ossResult = await ossCache.get(key, cacheType);
        
        if (ossResult?.value) {
          // 更新内存缓存
          localCache.set(key, {
            value: ossResult.value,
            lastModified: ossResult.lastModified,
          });
          
          debug(`成功从 OSS 获取并更新内存缓存: ${key}`);
          return ossResult;
        }
        
        return null;
      } catch (err) {
        // 如果是可忽略的错误（如缓存不存在），返回 null
        if (err instanceof IgnorableError) {
          debug(`OSS 缓存不存在: ${key}`);
          return null;
        }
        
        // 其他错误记录日志
        logError(`从 OSS 获取缓存失败: ${key}`, err);
        
        // 如果有内存缓存，即使过期也返回（降级策略）
        if (localCacheEntry) {
          debug(`使用过期的内存缓存（降级）: ${key}`);
          return {
            value: localCacheEntry.value,
            lastModified: localCacheEntry.lastModified,
          };
        }
        
        return null;
      }
    }
    
    // 没有 OSS 配置，只使用内存缓存
    return null;
  },

  /**
   * 设置缓存
   */
  async set(key, value, cacheType = 'cache') {
    const now = Date.now();
    
    // 如果配置了 OSS，尝试写入
    if (ossCache) {
      try {
        // 第一步：写入 OSS（持久化）
        debug(`设置 OSS 缓存: ${key}`);
        await ossCache.set(key, value, cacheType);
        
        // 第二步：更新内存缓存
        localCache.set(key, {
          value,
          lastModified: now,
        });
        
        debug(`成功设置多级缓存: ${key}`);
      } catch (err) {
        logError(`设置 OSS 缓存失败: ${key}`, err);
        
        // 即使 OSS 写入失败，也更新内存缓存
        localCache.set(key, {
          value,
          lastModified: now,
        });
      }
    } else {
      // 没有 OSS 配置，只更新内存缓存
      localCache.set(key, {
        value,
        lastModified: now,
      });
      debug(`成功设置内存缓存: ${key}`);
    }
  },

  /**
   * 删除缓存
   */
  async delete(key) {
    // 如果配置了 OSS，尝试删除
    if (ossCache) {
      try {
        // 从 OSS 删除
        debug(`删除 OSS 缓存: ${key}`);
        await ossCache.delete(key);
        
        // 从内存缓存删除
        localCache.delete(key);
        
        debug(`成功删除多级缓存: ${key}`);
      } catch (err) {
        logError(`删除 OSS 缓存失败: ${key}`, err);
        
        // 即使 OSS 删除失败，也删除内存缓存
        localCache.delete(key);
      }
    } else {
      // 没有 OSS 配置，只删除内存缓存
      localCache.delete(key);
      debug(`成功删除内存缓存: ${key}`);
    }
  },
};

module.exports = multiTierCache;

