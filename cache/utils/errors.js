/**
 * 可忽略的错误（例如：缓存未找到）
 */
class IgnorableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IgnorableError';
  }
}

/**
 * 可恢复的错误（例如：网络超时，可以重试）
 */
class RecoverableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecoverableError';
  }
}

module.exports = { IgnorableError, RecoverableError };

