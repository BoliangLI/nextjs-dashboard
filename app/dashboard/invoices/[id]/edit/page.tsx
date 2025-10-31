import Form from '@/app/ui/invoices/edit-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchInvoiceById, fetchCustomers, fetchFilteredInvoices } from '@/app/lib/data';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  // 将第一页的invoice预渲染，用于静态生成
  const invoices = await fetchFilteredInvoices('', 1);
  return invoices.map((invoice) => ({ id: invoice.id }));
}


export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = props.params;
  const {id} = await params;
  const [invoice, customers] = await Promise.all([
    fetchInvoiceById(id),
    fetchCustomers(),
  ]);
  
  if (!invoice) {
    notFound();
  }
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Edit Invoice',
            href: `/dashboard/invoices/${id}/edit`,
            active: true,
          },
        ]}
      />
      <Form invoice={invoice} customers={customers} />
    </main>
  );
}