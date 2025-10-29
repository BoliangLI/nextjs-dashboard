import Form from '@/app/ui/invoices/edit-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchInvoiceById, fetchCustomers } from '@/app/lib/data';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

async function EditInvoiceForm({params}: {params: Promise<{ id: string }> }) {
  const {id} = await params;
  const [invoice, customers] = await Promise.all([
    fetchInvoiceById(id),
    fetchCustomers(),
  ]);
  
  if (!invoice) {
    notFound();
  }
  
  return <Form invoice={invoice} customers={customers} />;
}

async function SuspenseBreadcrumbs({params}: {params: Promise<{ id: string }> }) {
  const {id} = await params;
  return (
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
  );
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = props.params;
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <SuspenseBreadcrumbs params={params} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <EditInvoiceForm params={params} />
      </Suspense>
    </main>
  );
}