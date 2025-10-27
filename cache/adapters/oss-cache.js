/**
 * 阿里云 OSS 缓存适配器
 * 使用阿里云 OSS 作为持久化缓存存储
 */
const OSS = require('ali-oss');
const path = require('path');
const { IgnorableError, RecoverableError } = require('../utils/errors');
const { debug, error: logError } = require('../utils/logger');

/**
 * 从环境变量解析 OSS 客户端配置
 */
function parseOSSClientConfig() {
  const {
    OSS_REGION,
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
    OSS_BUCKET,
    OSS_ENDPOINT,
  } = process.env;

  if (!OSS_REGION || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET) {
    throw new Error('缺少必要的 OSS 配置环境变量');
  }

  return {
    region: OSS_REGION,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    bucket: OSS_BUCKET,
    endpoint: OSS_ENDPOINT,
    secure: true,
    timeout: 60000, // 60秒超时
  };
}

// 全局 OSS 客户端实例
let ossClient = null;

/**
 * 获取 OSS 客户端实例（单例）
 */
function getOSSClient() {
  if (!ossClient) {
    const config = parseOSSClientConfig();
    ossClient = new OSS(config);
  }
  return ossClient;
}

/**
 * 构建 OSS 对象键
 * @param {string} key - 缓存键
 * @param {('cache'|'fetch'|'composable')} extension - 缓存类型扩展名
 * @returns {string} OSS 对象键路径
 * 
 * 路径规则：
 * - cache: {prefix}/{buildId}/{key}.cache
 * - fetch: {prefix}/__fetch/{buildId}/{key} (无扩展名)
 * - composable: {prefix}/{buildId}/{key}.composable
 */
function buildOSSKey(key, extension = 'cache') {
  const { OSS_CACHE_PREFIX, NEXT_BUILD_ID } = process.env;
  const buildId = NEXT_BUILD_ID || 'default';
  const prefix = OSS_CACHE_PREFIX || 'cache/';
  
  // fetch 类型有特殊的目录结构，且不带扩展名
  if (extension === 'fetch') {
    return path.posix.join(prefix, '__fetch', buildId, key);
  }
  
  // cache 和 composable 类型在同一目录，但有不同的扩展名
  return path.posix.join(prefix, buildId, `${key}.${extension}`);
}

/**
 * OSS 缓存实现
 */
const ossCache = {
  name: 'oss',

  /**
   * 从 OSS 获取缓存
   * @param {string} key - 缓存键
   * @param {('cache'|'fetch'|'composable')} cacheType - 缓存类型
   */
  async get(key, cacheType = 'cache') {
    try {
      const client = getOSSClient();
      const ossKey = buildOSSKey(key, cacheType);
      
      debug(`📥 从 OSS 获取 [${cacheType}] 缓存: ${ossKey}`);
      
      const result = await client.get(ossKey);
      
      if (!result || !result.content) {
        return null;
      }

      // 解析缓存数据
      const cacheData = JSON.parse(result.content.toString('utf-8'));
      
      // 获取最后修改时间
      const lastModified = result.res?.headers?.['last-modified']
        ? new Date(result.res.headers['last-modified']).getTime()
        : Date.now();

      debug(`✅ 成功从 OSS 获取 [${cacheType}] 缓存: ${ossKey}`);
      
      return {
        value: cacheData,
        lastModified,
      };
    } catch (err) {
      // 如果对象不存在，返回 null
      if (err.code === 'NoSuchKey' || err.status === 404) {
        debug(`❌ OSS [${cacheType}] 缓存不存在: ${key}`);
        throw new IgnorableError('缓存不存在');
      }
      
      // 其他错误记录并抛出
      logError(`❌ 从 OSS 获取 [${cacheType}] 缓存失败: ${key}`, err);
      throw new RecoverableError(`获取缓存失败: ${err.message}`);
    }
  },

  /**
   * 设置 OSS 缓存
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {('cache'|'fetch'|'composable')} cacheType - 缓存类型
   */
  async set(key, value, cacheType = 'cache') {
    try {
      const client = getOSSClient();
      const ossKey = buildOSSKey(key, cacheType);
      
      debug(`💾 设置 OSS [${cacheType}] 缓存: ${ossKey}`);
      
      // 将值序列化为 JSON
      const content = JSON.stringify(value);
      
      // 上传到 OSS
      await client.put(ossKey, Buffer.from(content, 'utf-8'), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
      
      debug(`✅ 成功设置 OSS [${cacheType}] 缓存: ${ossKey}, 大小: ${content.length} bytes`);
    } catch (err) {
      logError(`❌ 设置 OSS [${cacheType}] 缓存失败: ${key}`, err);
      throw new RecoverableError(`设置缓存失败: ${err.message}`);
    }
  },

  /**
   * 删除 OSS 缓存
   */
  async delete(key) {
    try {
      const client = getOSSClient();
      const ossKey = buildOSSKey(key, 'cache');
      
      debug(`删除 OSS 缓存: ${ossKey}`);
      
      await client.delete(ossKey);
      
      debug(`成功删除 OSS 缓存: ${ossKey}`);
    } catch (err) {
      // 删除不存在的对象不算错误
      if (err.code === 'NoSuchKey' || err.status === 404) {
        debug(`OSS 缓存已不存在: ${key}`);
        return;
      }
      
      logError(`删除 OSS 缓存失败: ${key}`, err);
      throw new RecoverableError(`删除缓存失败: ${err.message}`);
    }
  },
};

module.exports = ossCache;

