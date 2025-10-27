/**
 * 测试缓存页面
 * 这个页面用于测试多级缓存功能
 */

// 启用 ISR，60秒重新验证
export const revalidate = 60;

async function getData() {
  // 模拟数据获取
  const timestamp = new Date().toISOString();
  console.log('🔄 getData 被调用:', timestamp);
  
  return {
    message: '这是缓存测试页面',
    timestamp,
    random: Math.random(),
  };
}

export default async function TestCachePage() {
  const data = await getData();
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 缓存测试页面</h1>
      
      <div style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        marginTop: '20px',
        borderRadius: '8px'
      }}>
        <h2>缓存信息：</h2>
        <p><strong>消息：</strong> {data.message}</p>
        <p><strong>生成时间：</strong> {data.timestamp}</p>
        <p><strong>随机数：</strong> {data.random}</p>
      </div>
      
      <div style={{ 
        background: '#e3f2fd', 
        padding: '20px', 
        marginTop: '20px',
        borderRadius: '8px'
      }}>
        <h2>测试说明：</h2>
        <ul>
          <li>✅ 此页面启用了 ISR（revalidate: 60秒）</li>
          <li>✅ 第一次访问会生成页面并缓存</li>
          <li>✅ 60秒内的访问会从缓存返回（时间戳相同）</li>
          <li>✅ 60秒后会重新生成页面</li>
        </ul>
        
        <p style={{ marginTop: '20px' }}>
          <strong>如何测试：</strong><br/>
          1. 刷新页面多次，观察时间戳是否变化<br/>
          2. 查看终端日志，看是否有缓存操作<br/>
          3. 等待60秒后再刷新，时间戳应该更新
        </p>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <a 
          href="/test-cache"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            fontSize: '16px',
            textDecoration: 'none',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          🔄 刷新页面
        </a>
      </div>
    </div>
  );
}

