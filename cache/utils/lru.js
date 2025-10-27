/**
 * LRU (Least Recently Used) 缓存实现
 * 当缓存达到最大容量时，删除最久未使用的项
 */
class LRUCache {
  constructor(maxSize) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存项
   * 访问时会将该项移至最近使用位置
   */
  get(key) {
    const result = this.cache.get(key);
    if (result !== undefined) {
      // 删除后重新设置，确保它成为最近使用的
      this.cache.delete(key);
      this.cache.set(key, result);
    }
    return result;
  }

  /**
   * 设置缓存项
   * 如果缓存已满，删除最久未使用的项
   */
  set(key, value) {
    // 如果键已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // 如果缓存已满，删除最早的项（Map 中第一个键）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  /**
   * 删除缓存项
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size() {
    return this.cache.size;
  }
}

module.exports = { LRUCache };

