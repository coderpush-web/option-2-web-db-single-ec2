import { db, invoices as mockInvoices, customers as mockCustomers, revenue as mockRevenue } from './db';
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
  try {
    const data = db.prepare('SELECT * FROM revenue').all() as Revenue[];
    if (data && data.length > 0) return data;
  } catch (error) {
    console.error('Failed to fetch revenue from SQLite:', error);
  }
  return mockRevenue as Revenue[];
}

export async function fetchLatestInvoices() {
  try {
    const data = db.prepare(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `).all() as any[];

    if (data && data.length > 0) {
      return data.map((invoice: any) => ({
        ...invoice,
        amount: formatCurrency(invoice.amount),
      }));
    }
  } catch (error) {
    console.error('Failed to fetch latest invoices from SQLite:', error);
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
  try {
    const invoiceCountRow = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
    const customerCountRow = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
    const statusRow = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
      FROM invoices
    `).get() as { paid: number | null; pending: number | null };

    const numberOfInvoices = Number(invoiceCountRow?.count ?? 0);
    const numberOfCustomers = Number(customerCountRow?.count ?? 0);
    const totalPaidInvoices = formatCurrency(statusRow?.paid ?? 0);
    const totalPendingInvoices = formatCurrency(statusRow?.pending ?? 0);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Failed to fetch card data from SQLite:', error);
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
  try {
    const searchTerm = `%${query}%`;
    const invoices = db.prepare(`
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
        customers.name LIKE ? OR
        customers.email LIKE ? OR
        CAST(invoices.amount AS TEXT) LIKE ? OR
        invoices.date LIKE ? OR
        invoices.status LIKE ?
      ORDER BY invoices.date DESC
      LIMIT ? OFFSET ?
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, ITEMS_PER_PAGE, offset) as InvoicesTable[];
    return invoices;
  } catch (error) {
    console.error('Failed to fetch filtered invoices from SQLite:', error);
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
  try {
    const searchTerm = `%${query}%`;
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name LIKE ? OR
        customers.email LIKE ? OR
        CAST(invoices.amount AS TEXT) LIKE ? OR
        invoices.date LIKE ? OR
        invoices.status LIKE ?
    `).get(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm) as { count: number };
    return Math.ceil(Number(row?.count ?? 0) / ITEMS_PER_PAGE);
  } catch (error) {
    console.error('Failed to fetch invoice pages count from SQLite:', error);
  }
  return Math.ceil(mockInvoices.length / ITEMS_PER_PAGE);
}

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = db.prepare(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ?
    `).get(id) as any;

    if (invoice) {
      return {
        ...invoice,
        amount: invoice.amount / 100,
      };
    }
  } catch (error) {
    console.error('Failed to fetch invoice by id from SQLite:', error);
  }
  const found = mockInvoices.find((i: any) => i.id === id);
  if (!found) return null;
  return {
    id: (found as any).id || id || 'inv-id',
    customer_id: found.customer_id,
    amount: found.amount / 100,
    status: found.status,
  };
}

export async function fetchCustomers() {
  try {
    const customers = db.prepare(`
      SELECT id, name
      FROM customers
      ORDER BY name ASC
    `).all() as CustomerField[];
    return customers;
  } catch (err) {
    console.error('Failed to fetch customers from SQLite:', err);
  }
  return mockCustomers.map((c) => ({ id: c.id, name: c.name }));
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const searchTerm = `%${query}%`;
    const data = db.prepare(`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name LIKE ? OR
        customers.email LIKE ?
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `).all(searchTerm, searchTerm) as any[];

    const customers = data.map((customer: any) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending ?? 0),
      total_paid: formatCurrency(customer.total_paid ?? 0),
    }));
    return customers;
  } catch (err) {
    console.error('Failed to fetch filtered customers from SQLite:', err);
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
