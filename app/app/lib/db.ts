import postgres from 'postgres';
import { invoices, customers, revenue } from './placeholder-data';

let sqlClient: any = null;

if (process.env.POSTGRES_URL) {
  try {
    sqlClient = postgres(process.env.POSTGRES_URL, {
      ssl: process.env.POSTGRES_URL.includes('sslmode=require') ? 'require' : false,
      connect_timeout: 4
    });
  } catch (e) {
    console.error('Failed to init postgres client:', e);
  }
}

export { sqlClient, invoices, customers, revenue };
