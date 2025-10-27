/**
 * 日志工具
 */

const isDebug = process.env.CACHE_DEBUG === 'true';

function debug(...args) {
  if (isDebug) {
    console.log('[Cache Debug]', ...args);
  }
}

function info(...args) {
  console.info('[Cache Info]', ...args);
}

function warn(...args) {
  console.warn('[Cache Warn]', ...args);
}

function error(...args) {
  console.error('[Cache Error]', ...args);
}

module.exports = { debug, info, warn, error };

