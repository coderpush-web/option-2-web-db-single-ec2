import { sqlClient, invoices as mockInvoices, customers as mockCustomers, revenue as mockRevenue } from './db';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

export async function fetchRevenue() {
  if (sqlClient) {
    try {
      const data = await sqlClient`SELECT * FROM revenue`;
      if (data && data.length > 0) return data;
    } catch (error) {
      console.log('Using placeholder revenue data due to DB offline:', error);
    }
  }
  return mockRevenue as Revenue[];
}

export async function fetchLatestInvoices() {
  if (sqlClient) {
    try {
      const data = await sqlClient`
        SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        ORDER BY invoices.date DESC
        LIMIT 5`;
      if (data && data.length > 0) {
        return data.map((invoice: any) => ({
          ...invoice,
          amount: formatCurrency(invoice.amount),
        }));
      }
    } catch (error) {
      console.log('Using placeholder latest invoices due to DB offline:', error);
    }
  }
  return mockInvoices.slice(0, 5).map((inv: any) => {
    const cust = mockCustomers.find((c) => c.id === inv.customer_id);
    return {
      id: inv.id || 'inv-1',
      name: cust ? cust.name : 'Lee Robinson',
      image_url: cust ? cust.image_url : '/customers/lee-robinson.png',
      email: cust ? cust.email : 'lee@vercel.com',
      amount: formatCurrency(inv.amount),
    };
  });
}

export async function fetchCardData() {
  if (sqlClient) {
    try {
      const invoiceCountPromise = sqlClient`SELECT COUNT(*) FROM invoices`;
      const customerCountPromise = sqlClient`SELECT COUNT(*) FROM customers`;
      const invoiceStatusPromise = sqlClient`SELECT
           SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
           SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
           FROM invoices`;

      const data = await Promise.all([
        invoiceCountPromise,
        customerCountPromise,
        invoiceStatusPromise,
      ]);

      const numberOfInvoices = Number(data[0][0].count ?? '0');
      const numberOfCustomers = Number(data[1][0].count ?? '0');
      const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
      const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

      return {
        numberOfCustomers,
        numberOfInvoices,
        totalPaidInvoices,
        totalPendingInvoices,
      };
    } catch (error) {
      console.log('Using placeholder card data due to DB offline:', error);
    }
  }
  return {
    numberOfCustomers: mockCustomers.length,
    numberOfInvoices: mockInvoices.length,
    totalPaidInvoices: '$3,250.00',
    totalPendingInvoices: '$1,260.00',
  };
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  if (sqlClient) {
    try {
      const invoices = await sqlClient`
        SELECT
          invoices.id,
          invoices.amount,
          invoices.date,
          invoices.status,
          customers.name,
          customers.email,
          customers.image_url
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE
          customers.name ILIKE ${`%${query}%`} OR
          customers.email ILIKE ${`%${query}%`} OR
          invoices.amount::text ILIKE ${`%${query}%`} OR
          invoices.date::text ILIKE ${`%${query}%`} OR
          invoices.status ILIKE ${`%${query}%`}
        ORDER BY invoices.date DESC
        LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
      `;
      return invoices;
    } catch (error) {
      console.log('Fallback to mock filtered invoices');
    }
  }
  return mockInvoices.slice(offset, offset + ITEMS_PER_PAGE).map((inv: any) => {
    const cust = mockCustomers.find((c) => c.id === inv.customer_id);
    return {
      id: inv.id || 'inv-id',
      amount: inv.amount,
      date: inv.date,
      status: inv.status,
      name: cust ? cust.name : 'Client',
      email: cust ? cust.email : 'client@example.com',
      image_url: cust ? cust.image_url : '/customers/delba-de-oliveira.png',
    };
  });
}

export async function fetchInvoicesPages(query: string) {
  if (sqlClient) {
    try {
      const count = await sqlClient`SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    `;
      return Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);
    } catch (error) {
      console.log('Fallback to mock pages count');
    }
  }
  return Math.ceil(mockInvoices.length / ITEMS_PER_PAGE);
}

export async function fetchInvoiceById(id: string) {
  if (sqlClient) {
    try {
      const data = await sqlClient`
        SELECT
          invoices.id,
          invoices.customer_id,
          invoices.amount,
          invoices.status
        FROM invoices
        WHERE invoices.id = ${id};
      `;
      const invoice = data.map((invoice: any) => ({
        ...invoice,
        amount: invoice.amount / 100,
      }));
      return invoice[0];
    } catch (error) {
      console.log('Fallback to mock invoice by id');
    }
  }
  const found = mockInvoices.find((i) => i.id === id);
  if (!found) return null;
  return {
    id: found.id || 'inv-id',
    customer_id: found.customer_id,
    amount: found.amount / 100,
    status: found.status,
  };
}

export async function fetchCustomers() {
  if (sqlClient) {
    try {
      const customers = await sqlClient`
        SELECT
          id,
          name
        FROM customers
        ORDER BY name ASC
      `;
      return customers;
    } catch (err) {
      console.log('Fallback to mock customers');
    }
  }
  return mockCustomers.map((c) => ({ id: c.id, name: c.name }));
}

export async function fetchFilteredCustomers(query: string) {
  if (sqlClient) {
    try {
      const data = await sqlClient`
  		SELECT
  		  customers.id,
  		  customers.name,
  		  customers.email,
  		  customers.image_url,
  		  COUNT(invoices.id) AS total_invoices,
  		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
  		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
  		FROM customers
  		LEFT JOIN invoices ON customers.id = invoices.customer_id
  		WHERE
  		  customers.name ILIKE ${`%${query}%`} OR
          customers.email ILIKE ${`%${query}%`}
  		GROUP BY customers.id, customers.name, customers.email, customers.image_url
  		ORDER BY customers.name ASC
  	  `;
      const customers = data.map((customer: any) => ({
        ...customer,
        total_pending: formatCurrency(customer.total_pending),
        total_paid: formatCurrency(customer.total_paid),
      }));
      return customers;
    } catch (err) {
      console.log('Fallback to mock filtered customers');
    }
  }
  return mockCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    image_url: c.image_url,
    total_invoices: 2,
    total_pending: '$100.00',
    total_paid: '$500.00',
  }));
}
