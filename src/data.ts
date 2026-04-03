import { Product, Customer, Invoice } from './types';

export const initialCustomers: Customer[] = [
  { id: 's1', name: 'Fresh Farms Co.', shopName: 'Fresh Farms Shop', address: '123 Farm Lane', dueDate: '2026-04-15', contact: '555-0101', email: 'orders@freshfarms.com' },
  { id: 's2', name: 'Global Grocers', shopName: 'Global Grocers Store', address: '456 Global Ave', dueDate: '2026-04-20', contact: '555-0202', email: 'supply@globalgrocers.com' },
  { id: 's3', name: 'Dairy Best', shopName: 'Dairy Best Market', address: '789 Dairy Rd', dueDate: '2026-04-10', contact: '555-0303', email: 'sales@dairybest.com' },
];

export const initialProducts: Product[] = [
  { id: 'p1', name: 'Organic Apples', quantityCategory: 'kg', price: 2.99, stock: 150, customerId: 's1' },
  { id: 'p2', name: 'Whole Milk 1 Gal', quantityCategory: 'liters', price: 3.49, stock: 45, customerId: 's3' },
  { id: 'p3', name: 'Whole Wheat Bread', quantityCategory: 'pcs', price: 2.49, stock: 30, customerId: 's2' },
  { id: 'p4', name: 'Free Range Eggs (Dozen)', quantityCategory: 'pcs', price: 4.99, stock: 60, customerId: 's1' },
  { id: 'p5', name: 'Avocados', quantityCategory: 'pcs', price: 1.50, stock: 8, customerId: 's1' }, // Low stock
  { id: 'p6', name: 'Cheddar Cheese', quantityCategory: 'kg', price: 5.99, stock: 25, customerId: 's3' },
  { id: 'p7', name: 'Pasta Sauce', quantityCategory: 'jars', price: 3.99, stock: 120, customerId: 's2' },
  { id: 'p8', name: 'Spaghetti', quantityCategory: 'packs', price: 1.99, stock: 200, customerId: 's2' },
];

export const initialInvoices: Invoice[] = [
  {
    id: 'INV-1001',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    customerName: 'Walk-in Customer',
    items: [
      { product: initialProducts[0], quantity: 5 },
      { product: initialProducts[2], quantity: 2 },
    ],
    total: 19.93,
    status: 'Paid',
    amountPaid: 19.93,
  },
  {
    id: 'INV-1002',
    date: new Date(Date.now() - 86400000).toISOString(),
    customerName: 'Alice Smith',
    items: [
      { product: initialProducts[1], quantity: 1 },
      { product: initialProducts[3], quantity: 2 },
      { product: initialProducts[5], quantity: 1 },
    ],
    total: 19.46,
    status: 'Paid',
    amountPaid: 19.46,
  },
];
