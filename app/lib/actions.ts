'use server';

import { z } from 'zod';
import postgres from 'postgres';
import { cacheLife, cacheTag, revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
 
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

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData){
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
 
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
 
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // We'll also log the error to the console for now
    console.error(error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }
 
  // 清除所有相关页面的缓存
  revalidatePath('/dashboard/invoices');
  revalidatePath('/dashboard');
  redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// ...
 
export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }
 
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
 
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Update invoice error:', error);
    return { message: 'Database Error: Failed to Update Invoice.' };
  }
 
  // 清除所有相关页面的缓存
  // revalidateTag('invoices', 'max');
  revalidatePath('/dashboard/invoices'); // 清除发票列表页
  revalidatePath('/dashboard'); // 清除仪表板首页
  revalidatePath(`/dashboard/invoices/${id}/edit`); // 清除编辑页
  
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    
    // 清除所有相关页面的缓存
    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Delete invoice error:', error);
    throw new Error('Failed to delete invoice.');
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

export async function getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    console.log(`执行了getCurrentTime函数，时间戳为: ${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function updateCurrentTime() {
    revalidatePath('/dashboard/time');
}