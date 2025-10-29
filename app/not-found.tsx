import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '20px 0' }}>页面未找到</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        抱歉，您访问的页面不存在。
      </p>
      <Link
        href="/"
        style={{
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px'
        }}
      >
        返回首页
      </Link>
    </div>
  );
}

