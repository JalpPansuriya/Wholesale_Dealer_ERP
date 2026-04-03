export type Product = {
  id: string;
  name: string;
  quantityCategory: string;
  price: number;
  stock: number;
  customerId: string;
};

export type Customer = {
  id: string;
  name: string;
  shopName: string;
  address: string;
  dueDate: string;
  contact: string;
  email: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type Invoice = {
  id: string;
  date: string;
  customerName: string;
  customerId?: string;
  customer?: Customer;
  items: CartItem[];
  total: number;
  status: 'Paid' | 'Unpaid' | 'Partially Paid';
  amountPaid: number;
};
