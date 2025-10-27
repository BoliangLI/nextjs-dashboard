import postgres from 'postgres';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('数据库连接字符串未配置，请设置 POSTGRES_URL 或 DATABASE_URL 环境变量');
}

// SSL 配置：支持 require/prefer/allow/disable
const sslMode = process.env.POSTGRES_SSL_MODE || 'prefer';
const sslConfig = sslMode === 'disable' ? false : sslMode;

const sql = postgres(connectionString, {
  ssl: sslConfig as any,
  max: 1, // seed 只需要一个连接
  idle_timeout: 20,
  connect_timeout: 10,
});

async function listInvoices() {
	const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

	return data;
}

export async function GET() {
  try {
  	return Response.json(await listInvoices());
  } catch (error) {
  	return Response.json({ error }, { status: 500 });
  }
}
