/**
 * Next.js 自定义缓存处理器
 * 
 * 这个类实现了 Next.js 的 CacheHandler 接口
 * 用于拦截和处理 Next.js 的缓存操作
 * 
 * 使用方法：
 * 在 next.config.ts 中配置：
 * {
 *   cacheHandler: require.resolve('./cache-handler.js'),
 *   cacheMaxMemorySize: 0, // 禁用默认内存缓存
 * }
 */

const { threeTierCache } = require('./cache');
const { debug, error: logError, info } = require('./cache/utils/logger');
/**
 * 判断是否为 Fetch 缓存
 */
function isFetchCache(
  options){
  if (typeof options === 'boolean') {
    return options;
  }
  if (typeof options === 'object' && options !== null) {
    return (
      options.kindHint === 'fetch' ||
      options.fetchCache === true ||
      options.kind === 'FETCH'
    );
  }
  return false;
}

/**
 * 从二进制内容类型判断是否需要 base64 编码
 */
function isBinaryContentType(contentType) {
  if (!contentType) return false;
  return (
    contentType.includes('image/') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pdf') ||
    contentType.includes('video/') ||
    contentType.includes('audio/')
  );
}

/**
 * 自定义缓存处理器
 */
class CustomCacheHandler {
  constructor(options) {
    this.options = options;
    // info('初始化自定义缓存处理器', {
    //   cacheMaxMemorySize: options?.cacheMaxMemorySize,
    //   flushToDisk: options?.flushToDisk,
    // });
  }

  /**
   * 获取缓存
   */
  async get(key, options) {
    try {
      const cacheType = isFetchCache(options) ? 'fetch' : 'cache';
      debug(`获取缓存: ${key}, 类型: ${cacheType}`);

      const result = await threeTierCache.get(key, cacheType);

      if (!result?.value) {
        debug(`缓存未命中: ${key}`);
        return null;
      }

      const { value, lastModified } = result;

      debug(`缓存命中: ${key}`);

      // 处理不同类型的缓存数据
      if (cacheType === 'fetch') {
        // Fetch 缓存
        return {
          lastModified,
          value: value,
        };
      } else {
        // 页面/路由缓存
        return {
          lastModified,
          value: this.transformCacheValue(value),
        };
      }
    } catch (err) {
      logError(`获取缓存失败: ${key}`, err);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(key, data, ctx) {
    try {
      if (data === null || data === undefined) {
        debug(`删除缓存: ${key}`);
        await threeTierCache.delete(key);
        return;
      }

      // 判断缓存类型
      const isFetch = ctx?.fetchCache === true || data?.kind === 'FETCH';
      const cacheType = isFetch ? 'fetch' : 'cache';

      debug(`设置缓存: ${key}, 类型: ${cacheType}`, {
        kind: data?.kind,
        revalidate: ctx?.revalidate,
      });

      // 转换缓存数据
      const valueToStore = this.transformValueForStorage(data, ctx);

      await threeTierCache.set(key, valueToStore, cacheType);

      debug(`成功设置缓存: ${key}`);
    } catch (err) {
      logError(`设置缓存失败: ${key}`, err);
      // 不抛出错误，避免影响页面渲染
    }
  }

  /**
   * 根据标签重新验证缓存
   * 注意：简化实现，实际项目中可能需要维护 tag-to-key 的映射
   */
  async revalidateTag(tag) {
    try {
      info(`重新验证标签: ${tag}`);
      // 在完整实现中，这里应该：
      // 1. 查找所有与该 tag 关联的缓存键
      // 2. 删除或标记这些缓存为失效
      // 由于我们的简化实现没有维护 tag-to-key 映射，这里只是记录日志
      debug(`标签重新验证（简化实现）: ${tag}`);
    } catch (err) {
      logError(`重新验证标签失败: ${tag}`, err);
    }
  }

  /**
   * 转换缓存值用于存储
   */
  transformValueForStorage(data, ctx) {
    if (!data) return data;

    const result = {
      revalidate: ctx?.revalidate,
    };

    switch (data.kind) {
      case 'ROUTE':
      case 'APP_ROUTE': {
        result.type = 'route';
        result.body = data.body?.toString(
          isBinaryContentType(data.headers?.['content-type']) ? 'base64' : 'utf8'
        );
        result.meta = {
          status: data.status,
          headers: data.headers,
        };
        break;
      }

      case 'PAGE':
      case 'PAGES': {
        const isAppPath = typeof data.pageData === 'string';
        if (isAppPath) {
          result.type = 'app';
          result.html = data.html;
          result.rsc = data.pageData;
          result.meta = {
            status: data.status,
            headers: data.headers,
          };
        } else {
          result.type = 'page';
          result.html = data.html;
          result.json = data.pageData;
        }
        break;
      }

      case 'APP_PAGE': {
        result.type = 'app';
        result.html = data.html;
        result.rsc = data.rscData?.toString('utf8');
        result.meta = {
          status: data.status,
          headers: data.headers,
        };
        break;
      }

      case 'FETCH':
        return data;

      case 'REDIRECT':
        result.type = 'redirect';
        result.props = data.props;
        break;

      case 'IMAGE':
        // 图片优化缓存暂不实现
        return data;

      default:
        return data;
    }
    
    return result;
  }

  /**
   * 转换缓存值用于返回
   */
  transformCacheValue(cacheData) {
    if (!cacheData) return null;

    const meta = cacheData.meta;

    switch (cacheData.type) {
      case 'route':
        return {
          kind: 'ROUTE',
          body: Buffer.from(
            cacheData.body ?? '',
            isBinaryContentType(meta?.headers?.['content-type']) ? 'base64' : 'utf8'
          ),
          status: meta?.status,
          headers: meta?.headers,
        };

      case 'page':
        return {
          kind: 'PAGE',
          html: cacheData.html,
          pageData: cacheData.json,
          status: meta?.status,
          headers: meta?.headers,
        };

      case 'app':
        return {
          kind: 'APP_PAGE',
          html: cacheData.html,
          pageData: cacheData.rsc,
          rscData: cacheData.rsc ? Buffer.from(cacheData.rsc, 'utf8') : undefined,
          status: meta?.status,
          headers: meta?.headers,
        };

      case 'redirect':
        return {
          kind: 'REDIRECT',
          props: cacheData.props,
        };

      default:
        return cacheData;
    }
  }

  /**
   * 重置缓存（用于开发模式）
   */
  async resetRequestCache() {
    debug('重置请求缓存');
  }
}

// 导出为 CommonJS 模块（Next.js 要求）
module.exports = CustomCacheHandler;

