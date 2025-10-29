import Form from '@/app/ui/invoices/create-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchCustomers } from '@/app/lib/data';
import { Suspense } from 'react';

async function CreateInvoiceForm() {
  const customers = await fetchCustomers();
  return <Form customers={customers} />;
}
 
export default function Page() {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Create Invoice',
            href: '/dashboard/invoices/create',
            active: true,
          },
        ]}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <CreateInvoiceForm />
      </Suspense>
    </main>
  );
}