import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  
  // 配置自定义缓存处理器（使用绝对路径）
  cacheHandler: require.resolve( './cache-handler.js'),
  
  // 禁用默认内存缓存，使用我们的自定义缓存
  cacheMaxMemorySize: 0,
  
};

export default nextConfig;
