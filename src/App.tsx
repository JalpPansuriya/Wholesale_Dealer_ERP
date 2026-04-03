/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import Login from './components/Login';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Plus,
  Edit,
  Trash,
  Check,
  X,
  Search,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Printer,
  Menu,
  Download,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Calendar,
  LogOut
} from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Product, Customer, Invoice, CartItem } from './types';
import { initialProducts, initialCustomers, initialInvoices } from './data';

type View = 'dashboard' | 'inventory' | 'customers' | 'billing' | 'invoices';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // App State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setCustomers([]);
      setInvoices([]);
      return;
    }

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });
    return () => {
      unsubProducts();
      unsubCustomers();
      unsubInvoices();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Billing State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const handleAddProduct = async (product: Product) => {
    const { id, ...data } = product; // Remove placeholder ID
    await addDoc(collection(db, 'products'), data);
  };
  const handleUpdateProduct = async (updated: Product) => {
    const { id, ...data } = updated;
    await updateDoc(doc(db, 'products', id), data);
  };
  const handleDeleteProduct = async (id: string) => {
    await deleteDoc(doc(db, 'products', id));
  };

  const handleAddCustomer = async (customer: Customer) => {
    const { id, ...data } = customer;
    await addDoc(collection(db, 'customers'), data);
  };
  const handleUpdateCustomer = async (updated: Customer) => {
    const { id, ...data } = updated;
    await updateDoc(doc(db, 'customers', id), data);
  };
  const handleDeleteCustomer = async (id: string) => {
    await deleteDoc(doc(db, 'customers', id));
  };

  const handleCheckout = async (status: Invoice['status'], amountPaidInput?: number) => {
    if (cart.length === 0 || isProcessing) return;
    
    try {
      setIsProcessing(true);
      const startTime = Date.now();

      const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      let amountPaid = 0;
      if (status === 'Paid') amountPaid = total;
      else if (status === 'Partially Paid') amountPaid = amountPaidInput || 0;
      
      const invoiceData = {
        date: new Date().toISOString(),
        customerName: customer ? (customer.shopName || customer.name) : 'Walk-in Customer',
        customerId: selectedCustomerId,
        customer: customer || null,
        items: cart,
        total,
        status,
        amountPaid
      };
      await addDoc(collection(db, 'invoices'), invoiceData);

      // Update stock
      for (const item of cart) {
        if (item.product && item.product.id) {
          const newStock = item.product.stock - item.quantity;
          await updateDoc(doc(db, 'products', item.product.id), { stock: newStock });
        }
      }

      // Reset the cart and selection
      setCart([]);
      setSelectedCustomerId('');
      
      // Calculate remaining time to fulfill the 3-second requirement
      const elapsedTime = Date.now() - startTime;
      const delay = Math.max(0, 3000 - elapsedTime);
      await new Promise(resolve => setTimeout(resolve, delay));

      setActiveView('invoices');
    } catch (error) {
      console.error('Error during checkout:', error);
      alert('Failed to save invoice. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: Invoice['status'], newAmountPaid?: number) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    let amountPaid = inv.amountPaid;
    if (newStatus === 'Paid') amountPaid = inv.total;
    else if (newStatus === 'Unpaid') amountPaid = 0;
    else if (newStatus === 'Partially Paid' && newAmountPaid !== undefined) amountPaid = newAmountPaid;
    
    await updateDoc(doc(db, 'invoices', invoiceId), { status: newStatus, amountPaid });
  };

  if (isLoadingAuth) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">સુરક્ષિત લોડિંગ...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative print:h-auto print:overflow-visible">
      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 print:hidden">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Soneshwar Namkeen</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        pt-16 md:pt-0 print:hidden
      `}>
        <div className="hidden md:flex p-6 border-b border-slate-200 items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Soneshwar Namkeen</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="ડેશબોર્ડ" active={activeView === 'dashboard'} onClick={() => { setActiveView('dashboard'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Package />} label="ઇન્વેન્ટરી" active={activeView === 'inventory'} onClick={() => { setActiveView('inventory'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Users />} label="ગ્રાહકો" active={activeView === 'customers'} onClick={() => { setActiveView('customers'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<DollarSign />} label="બિલિંગ" active={activeView === 'billing'} onClick={() => { setActiveView('billing'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<FileText />} label="ઇન્વૉઇસ" active={activeView === 'invoices'} onClick={() => { setActiveView('invoices'); setIsMobileMenuOpen(false); }} />
          
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>લૉગઆઉટ</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-10 md:hidden print:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0 print:pt-0 print:overflow-visible">
        {activeView === 'dashboard' && <div className="flex-1 overflow-auto"><DashboardView products={products} invoices={invoices} onViewAllInvoices={() => setActiveView('invoices')} onAddInvoice={() => setActiveView('billing')} /></div>}
        {activeView === 'inventory' && <div className="flex-1 overflow-auto"><InventoryView products={products} customers={customers} onAdd={handleAddProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} /></div>}
        {activeView === 'customers' && <div className="flex-1 overflow-auto"><CustomersView customers={customers} invoices={invoices} onAdd={handleAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} /></div>}
        {activeView === 'billing' && <div className="flex-1 overflow-hidden"><BillingView products={products} customers={customers} cart={cart} setCart={setCart} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} onCheckout={handleCheckout} isProcessing={isProcessing} /></div>}
        {activeView === 'invoices' && <div className="flex-1 overflow-auto print:overflow-visible"><InvoicesView invoices={invoices} onAddInvoice={() => setActiveView('billing')} onUpdateStatus={handleUpdateInvoiceStatus} /></div>}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active 
          ? 'bg-blue-50 text-blue-700 font-medium' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      <span>{label}</span>
    </button>
  );
}

// --- Views ---

function DashboardView({ products, invoices, onViewAllInvoices, onAddInvoice }: { products: Product[], invoices: Invoice[], onViewAllInvoices: () => void, onAddInvoice: () => void }) {
  const lowStock = products.filter(p => p.stock < 20);
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ડેશબોર્ડ વિહંગાવલોકન</h2>
        <button onClick={onAddInvoice} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> બિલ ઉમેરો
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="કુલ આવક" 
          value={`₹${totalRevenue.toFixed(2)}`} 
          icon={<TrendingUp className="w-6 h-6 text-green-600" />} 
          color="bg-green-100" 
        />
        <StatCard 
          title="કુલ વસ્તુઓ" 
          value={products.length.toString()} 
          icon={<Package className="w-6 h-6 text-blue-600" />} 
          color="bg-blue-100" 
        />
        <StatCard 
          title="ઓછો સ્ટોક એલર્ટ" 
          value={lowStock.length.toString()} 
          icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} 
          color="bg-orange-100" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            ઓછો સ્ટોક ધરાવતી વસ્તુઓ
          </h3>
          {lowStock.length === 0 ? (
            <p className="text-slate-500">બધી વસ્તુઓનો પૂરતો સ્ટોક છે.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-orange-700 font-bold">{p.stock} બાકી</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col max-h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              તમામ વેચાણ
            </h3>
            <button onClick={onViewAllInvoices} className="text-sm text-blue-600 hover:text-blue-800 font-medium">વિગતો જુઓ</button>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2">
            {invoices.map(inv => (
              <div key={inv.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="font-medium text-slate-800">{inv.id}</p>
                  <p className="text-sm text-slate-500">{new Date(inv.date).toLocaleDateString()}</p>
                </div>
                <span className="text-green-600 font-bold">₹{inv.total.toFixed(2)}</span>
              </div>
            ))}
            {invoices.length === 0 && (
              <p className="text-slate-500 text-center py-4">હજુ સુધી કોઈ વેચાણ નથી.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
      <div className={`p-4 rounded-full ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function InventoryView({ products, customers, onAdd, onUpdate, onDelete }: { products: Product[], customers: Customer[], onAdd: (p: Product) => void, onUpdate: (p: Product) => void, onDelete: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.quantityCategory.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ઇન્વેન્ટરી મેનેજમેન્ટ</h2>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> વસ્તુ ઉમેરો
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="વસ્તુઓ શોધો..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <tr>
              <th className="px-6 py-3 font-medium">નામ</th>
              <th className="px-6 py-3 font-medium">જથ્થાની કેટેગરી</th>
              <th className="px-6 py-3 font-medium">કિંમત</th>
              <th className="px-6 py-3 font-medium">સ્ટોક</th>
              <th className="px-6 py-3 font-medium text-right">ક્રિયાઓ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isAdding && (
              <ProductFormRow 
                customers={customers} 
                onSave={(p) => { onAdd(p); setIsAdding(false); }} 
                onCancel={() => setIsAdding(false)} 
              />
            )}
            {filteredProducts.map(product => (
              editingId === product.id ? (
                <ProductFormRow 
                  key={product.id} 
                  initialData={product} 
                  customers={customers} 
                  onSave={(p) => { onUpdate(p); setEditingId(null); }} 
                  onCancel={() => setEditingId(null)} 
                />
              ) : (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{product.name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">{product.quantityCategory}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-800">₹{product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${product.stock < 20 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setEditingId(product.id)} className="text-blue-600 hover:text-blue-800 p-1"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(product.id)} className="text-red-500 hover:text-red-700 p-1 ml-2"><Trash className="w-4 h-4" /></button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductFormRow({ initialData, customers, onSave, onCancel }: { key?: string | number, initialData?: Product, customers: Customer[], onSave: (p: Product) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    quantityCategory: string;
    price: number | '';
    stock: number | '';
    customerId: string;
  }>(initialData || {
    id: `p${Date.now()}`,
    name: '',
    quantityCategory: '',
    price: '',
    stock: '',
    customerId: customers[0]?.id || ''
  });

  return (
    <tr className="bg-blue-50/50">
      <td className="px-6 py-3"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="નામ" autoFocus /></td>
      <td className="px-6 py-3"><input type="text" value={formData.quantityCategory} onChange={e => setFormData({...formData, quantityCategory: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="જથ્થાની કેટેગરી" /></td>
      <td className="px-6 py-3"><input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="કિંમત" /></td>
      <td className="px-6 py-3"><input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value === '' ? '' : parseInt(e.target.value)})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="સ્ટોક" /></td>
      <td className="px-6 py-3 text-right whitespace-nowrap">
        <button onClick={() => onSave({ ...formData, price: typeof formData.price === 'number' ? formData.price : 0, stock: typeof formData.stock === 'number' ? formData.stock : 0 })} className="text-green-600 hover:text-green-800 p-1"><Check className="w-5 h-5" /></button>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 p-1 ml-1"><X className="w-5 h-5" /></button>
      </td>
    </tr>
  );
}

function CustomersView({ customers, invoices, onAdd, onUpdate, onDelete }: { customers: Customer[], invoices: Invoice[], onAdd: (c: Customer) => void, onUpdate: (c: Customer) => void, onDelete: (id: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  if (selectedCustomer) {
    return <CustomerDetail customer={selectedCustomer} invoices={invoices} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ગ્રાહકો</h2>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> ગ્રાહક ઉમેરો
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">નામ</th>
                <th className="px-6 py-3 font-medium">દુકાનનું નામ</th>
                <th className="px-6 py-3 font-medium">સરનામું</th>
                <th className="px-6 py-3 font-medium">નિયત તારીખ</th>
                <th className="px-6 py-3 font-medium">સંપર્ક</th>
              <th className="px-6 py-3 font-medium text-right">ક્રિયાઓ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isAdding && (
              <CustomerFormRow 
                onSave={(c) => { onAdd(c); setIsAdding(false); }} 
                onCancel={() => setIsAdding(false)} 
              />
            )}
            {customers.map(customer => (
              editingId === customer.id ? (
                <CustomerFormRow 
                  key={customer.id} 
                  initialData={customer} 
                  onSave={(c) => { onUpdate(c); setEditingId(null); }} 
                  onCancel={() => setEditingId(null)} 
                />
              ) : (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{customer.name}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.shopName}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.address}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.dueDate}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.contact}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => setSelectedCustomer(customer)} className="text-blue-600 hover:text-blue-800 p-1 mr-2" title="વિગતો જુઓ"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(customer.id)} className="text-blue-600 hover:text-blue-800 p-1" title="ફેરફાર કરો"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(customer.id)} className="text-red-500 hover:text-red-700 p-1 ml-2" title="કાઢી નાખો"><Trash className="w-4 h-4" /></button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerFormRow({ initialData, onSave, onCancel }: { key?: string | number, initialData?: Customer, onSave: (c: Customer) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState<Customer>(initialData || {
    id: `c${Date.now()}`,
    name: '',
    shopName: '',
    address: '',
    dueDate: '',
    contact: '',
    email: ''
  });

  return (
    <tr className="bg-blue-50/50">
      <td className="px-6 py-3"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="ગ્રાહકનું નામ" autoFocus /></td>
      <td className="px-6 py-3"><input type="text" value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="દુકાનનું નામ" /></td>
      <td className="px-6 py-3"><input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="સરનામું" /></td>
      <td className="px-6 py-3"><input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" /></td>
      <td className="px-6 py-3"><input type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" placeholder="ફોન" /></td>
      <td className="px-6 py-3 text-right whitespace-nowrap">
        <button onClick={() => onSave(formData)} className="text-green-600 hover:text-green-800 p-1"><Check className="w-5 h-5" /></button>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 p-1 ml-1"><X className="w-5 h-5" /></button>
      </td>
    </tr>
  );
}

function CustomerDetail({ customer, invoices, onBack }: { customer: Customer, invoices: Invoice[], onBack: () => void }) {
  const customerInvoices = invoices.filter(i => i.customerId === customer.id);
  const totalBilled = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = customerInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const balanceDue = totalBilled - totalPaid;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800">ગ્રાહકની વિગતો</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{customer.name}</h3>
              <p className="text-slate-500">{customer.shopName}</p>
            </div>
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              ગ્રાહક
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">સરનામું</p>
                <p className="text-slate-600">{customer.address || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">સંપર્ક</p>
                <p className="text-slate-600">{customer.contact || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">નિયત તારીખ</p>
                <p className="text-slate-600">{customer.dueDate || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-slate-800 mb-4">નાણાકીય સારાંશ</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">કુલ બિલ</p>
              <p className="text-2xl font-bold text-slate-800">₹{totalBilled.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">કુલ ચૂકવેલ</p>
              <p className="text-xl font-semibold text-green-600">₹{totalPaid.toFixed(2)}</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 mb-1">બાકી રકમ</p>
              <p className={`text-2xl font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                ₹{balanceDue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">ખરીદેલી વસ્તુઓ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">વસ્તુનું નામ</th>
                <th className="px-6 py-3 font-medium">કેટેગરી</th>
                <th className="px-6 py-3 font-medium text-right">કુલ જથ્થો</th>
                <th className="px-6 py-3 font-medium text-right">કુલ ખર્ચ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Object.values(customerInvoices.flatMap(inv => inv.items).reduce((acc, item) => {
                if (!acc[item.product.id]) {
                  acc[item.product.id] = { ...item.product, totalQuantity: 0, totalSpent: 0 };
                }
                acc[item.product.id].totalQuantity += item.quantity;
                acc[item.product.id].totalSpent += item.product.price * item.quantity;
                return acc;
              }, {} as Record<string, Product & { totalQuantity: number, totalSpent: number }>)).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    હજુ સુધી કોઈ વસ્તુ ખરીદી નથી.
                  </td>
                </tr>
              ) : (
                Object.values(customerInvoices.flatMap(inv => inv.items).reduce((acc, item) => {
                  if (!acc[item.product.id]) {
                    acc[item.product.id] = { ...item.product, totalQuantity: 0, totalSpent: 0 };
                  }
                  acc[item.product.id].totalQuantity += item.quantity;
                  acc[item.product.id].totalSpent += item.product.price * item.quantity;
                  return acc;
                }, {} as Record<string, Product & { totalQuantity: number, totalSpent: number }>)).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.quantityCategory}</td>
                    <td className="px-6 py-4 text-slate-800 text-right">{item.totalQuantity}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 text-right">₹{item.totalSpent.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">ઇન્વૉઇસ ઇતિહાસ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">ઇન્વૉઇસ ID</th>
                <th className="px-6 py-3 font-medium">તારીખ</th>
                <th className="px-6 py-3 font-medium">વસ્તુઓ</th>
                <th className="px-6 py-3 font-medium">કુલ</th>
                <th className="px-6 py-3 font-medium">ચૂકવેલ</th>
                <th className="px-6 py-3 font-medium">બાકી</th>
                <th className="px-6 py-3 font-medium">સ્થિતિ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customerInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    આ ગ્રાહક માટે કોઈ ઇન્વૉઇસ મળ્યા નથી.
                  </td>
                </tr>
              ) : (
                customerInvoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">#{invoice.id}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-slate-600">{invoice.items.length} વસ્તુઓ</td>
                    <td className="px-6 py-4 font-medium text-slate-800">₹{invoice.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-green-600">₹{invoice.amountPaid.toFixed(2)}</td>
                    <td className="px-6 py-4 text-red-600">₹{(invoice.total - invoice.amountPaid).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BillingView({ products, customers, cart, setCart, selectedCustomerId, setSelectedCustomerId, onCheckout, isProcessing }: { 
  products: Product[], customers: Customer[], cart: CartItem[], setCart: React.Dispatch<React.SetStateAction<CartItem[]>>, 
  selectedCustomerId: string, setSelectedCustomerId: (id: string) => void, onCheckout: (status: Invoice['status'], amountPaid?: number) => void,
  isProcessing: boolean
}) {
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<Invoice['status']>('Paid');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && p.stock > 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const addToCart = (product: Product) => {
    const existing = cart.find(c => c.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.product.id === productId) {
        const newQ = c.quantity + delta;
        if (newQ <= 0) return { ...c, quantity: 0 };
        if (newQ <= c.product.stock) return { ...c, quantity: newQ };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(c => c.product.id !== productId));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden">
      {/* Product Selection */}
      <div className="p-4 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col lg:flex-1 lg:overflow-hidden min-h-[60vh] lg:min-h-0">
        <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-3 lg:mb-6">બિલિંગ</h2>
        
        <div className="relative mb-4 lg:mb-6">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="ઉમેરવા માટે વસ્તુઓ શોધો..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 lg:py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base lg:text-lg shadow-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-3 lg:p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col h-full"
              >
                <span className="text-[10px] lg:text-xs font-semibold text-blue-600 mb-1">{product.quantityCategory}</span>
                <span className="font-bold text-slate-800 text-sm lg:text-lg leading-tight mb-2 flex-1">{product.name}</span>
                <div className="flex justify-between items-end w-full mt-auto">
                  <span className="text-green-600 font-bold text-base lg:text-xl">₹{product.price.toFixed(2)}</span>
                  <span className="text-[10px] lg:text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded">સ્ટોક: {product.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart / Invoice Panel */}
      <div className="w-full lg:w-96 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 flex-shrink-0 lg:h-auto">
        <div className="p-4 lg:p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-3 lg:mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> વર્તમાન ઓર્ડર
          </h3>
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm lg:text-base bg-white"
          >
            <option value="">વૉક-ઇન ગ્રાહક</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.shopName || c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 min-h-[250px] lg:min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
              <ShoppingCart className="w-10 h-10 lg:w-12 lg:h-12 mb-2 opacity-20" />
              <p className="text-sm lg:text-base">કાર્ટ ખાલી છે</p>
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex gap-2 lg:gap-3 bg-white p-2 lg:p-3 rounded-lg border border-slate-100 shadow-sm">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm lg:text-base line-clamp-1">{item.product.name}</p>
                    <p className="text-green-600 font-semibold text-sm lg:text-base">₹{item.product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    <div className="flex items-center gap-1 lg:gap-2 bg-slate-100 rounded-lg p-1 mt-1 lg:mt-0">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-blue-600">-</button>
                      <span className="w-4 text-center text-xs lg:text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-blue-600">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 lg:p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center mb-2 text-slate-600 text-sm lg:text-base">
            <span>પેટા સરવાળો</span>
            <span>₹{cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-3 lg:mb-6 text-slate-600 text-sm lg:text-base">
            <span>કર (0%)</span>
            <span>₹0.00</span>
          </div>
          <div className="flex justify-between items-center mb-4 lg:mb-6 text-lg lg:text-xl font-bold text-slate-800">
            <span>કુલ</span>
            <span className="text-green-600">₹{cartTotal.toFixed(2)}</span>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">ચુકવણીની સ્થિતિ</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setPaymentStatus('Paid')}
                className={`py-2 px-1 text-xs lg:text-sm font-medium rounded-lg border transition-colors ${paymentStatus === 'Paid' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                ચૂકવેલ
              </button>
              <button 
                onClick={() => setPaymentStatus('Partially Paid')}
                className={`py-2 px-1 text-xs lg:text-sm font-medium rounded-lg border transition-colors ${paymentStatus === 'Partially Paid' ? 'bg-yellow-100 border-yellow-500 text-yellow-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                આંશિક
              </button>
              <button 
                onClick={() => setPaymentStatus('Unpaid')}
                className={`py-2 px-1 text-xs lg:text-sm font-medium rounded-lg border transition-colors ${paymentStatus === 'Unpaid' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                બાકી
              </button>
            </div>
          </div>

          {paymentStatus === 'Partially Paid' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">ચૂકવેલ રકમ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>બાકી રકમ:</span>
                <span className="font-medium text-slate-700">
                  ₹{Math.max(0, cartTotal - (Number(amountPaid) || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <button 
            onClick={() => onCheckout(paymentStatus, Number(amountPaid) || 0)}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 lg:py-4 rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2 text-base lg:text-lg"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                સાચવી રહ્યું છે...
              </>
            ) : (
              <>
                <DollarSign className="w-5 h-5" /> ઇન્વૉઇસ સાચવો
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const colors = {
    'Paid': 'bg-green-100 text-green-700',
    'Partially Paid': 'bg-yellow-100 text-yellow-700',
    'Unpaid': 'bg-red-100 text-red-700'
  };
  const labels = {
    'Paid': 'ચૂકવેલ',
    'Partially Paid': 'આંશિક',
    'Unpaid': 'બાકી'
  };
  return (
    <span className={`${colors[status]} px-2 py-1 rounded text-xs font-bold whitespace-nowrap`}>
      {labels[status]}
    </span>
  );
}

function InvoicesView({ invoices, onAddInvoice, onUpdateStatus }: { invoices: Invoice[], onAddInvoice: () => void, onUpdateStatus: (id: string, status: Invoice['status'], amountPaid?: number) => void }) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  if (selectedInvoice) {
    return <InvoiceDetail 
      invoice={selectedInvoice} 
      onBack={() => setSelectedInvoice(null)} 
      onUpdateStatus={(status, amountPaid) => {
        onUpdateStatus(selectedInvoice.id, status, amountPaid);
        setSelectedInvoice({ ...selectedInvoice, status, amountPaid: amountPaid !== undefined ? amountPaid : selectedInvoice.amountPaid });
      }}
    />;
  }

  return (
    <div className="p-4 md:p-8 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ઇન્વૉઇસ અને બિલિંગ ઇતિહાસ</h2>
        <button onClick={onAddInvoice} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> ઇન્વૉઇસ ઉમેરો
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">ઇન્વૉઇસ ID</th>
                <th className="px-6 py-3 font-medium">તારીખ</th>
              <th className="px-6 py-3 font-medium">ગ્રાહક</th>
              <th className="px-6 py-3 font-medium">કુલ</th>
              <th className="px-6 py-3 font-medium">સ્થિતિ</th>
              <th className="px-6 py-3 font-medium text-right">ક્રિયા</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.map(invoice => (
              <tr key={invoice.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-blue-600">{invoice.id}</td>
                <td className="px-6 py-4 text-slate-600">{new Date(invoice.date).toLocaleString()}</td>
                <td className="px-6 py-4 text-slate-800">{invoice.customerName}</td>
                <td className="px-6 py-4 font-bold text-slate-800">₹{invoice.total.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={invoice.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedInvoice(invoice)}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 justify-end w-full"
                  >
                    જુઓ <FileText className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">કોઈ ઇન્વૉઇસ મળ્યા નથી.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, onBack, onUpdateStatus }: { invoice: Invoice, onBack: () => void, onUpdateStatus: (status: Invoice['status'], amountPaid?: number) => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editAmountPaid, setEditAmountPaid] = useState<number | ''>(invoice.amountPaid);

  const handleStatusChange = (newStatus: Invoice['status']) => {
    let newAmount: number | '' = editAmountPaid;
    if (newStatus === 'Paid') newAmount = invoice.total;
    else if (newStatus === 'Unpaid') newAmount = 0;
    
    setEditAmountPaid(newAmount);
    onUpdateStatus(newStatus, Number(newAmount) || 0);
  };

  const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? Number(e.target.value) : '';
    setEditAmountPaid(val);
  };

  const handleAmountPaidBlur = () => {
    onUpdateStatus('Partially Paid', Number(editAmountPaid) || 0);
  };

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    
    let wrapper: HTMLDivElement | null = null;
    try {
      setIsDownloading(true);
      
      const element = invoiceRef.current;
      
      // Create a wrapper to hold the clone off-screen
      wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      document.body.appendChild(wrapper);
      
      // Clone the invoice element
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Force desktop width so it doesn't get squished on mobile
      clone.style.width = '800px';
      clone.style.maxWidth = 'none';
      clone.style.margin = '0';
      
      // Remove overflow-x-auto to prevent scrollbars in the image
      const tableWrappers = clone.querySelectorAll('.overflow-x-auto');
      tableWrappers.forEach(tw => {
        tw.classList.remove('overflow-x-auto');
        tw.classList.add('overflow-visible');
      });
      
      wrapper.appendChild(clone);
      
      // Wait a small tick for browser to calculate layout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(clone, {
        pixelRatio: 2, // Higher quality
        backgroundColor: '#ffffff',
        filter: (node) => {
          // Exclude elements with data-html2canvas-ignore
          if (node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        }
      });
      
      // A4 dimensions in mm: 210 x 297
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoice.id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to download invoice. Please try again.');
    } finally {
      if (wrapper && document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-medium">
          &larr; ઇન્વૉઇસ પર પાછા ફરો
        </button>
        <div className="flex items-center gap-3">
          {invoice.status === 'Partially Paid' && (
            <div className="flex items-center gap-2 mr-2">
              <label className="text-sm font-medium text-slate-600">ચૂકવેલ રકમ: ₹</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={editAmountPaid}
                onChange={handleAmountPaidChange}
                onBlur={handleAmountPaidBlur}
                className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <select 
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value as Invoice['status'])}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Paid">ચૂકવેલ તરીકે ચિહ્નિત કરો</option>
            <option value="Partially Paid">આંશિક તરીકે ચિહ્નિત કરો</option>
            <option value="Unpaid">બાકી તરીકે ચિહ્નિત કરો</option>
          </select>
          <button 
            onClick={handleDownload} 
            disabled={isDownloading}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-70"
          >
            <Download className="w-4 h-4" /> 
            {isDownloading ? 'PDF બની રહ્યું છે...' : 'PDF ડાઉનલોડ કરો'}
          </button>
        </div>
      </div>

      <div ref={invoiceRef} className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start mb-12 border-b border-slate-200 pb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-600 mb-2">ફ્રેશમાર્ટ</h1>
            <p className="text-slate-500">૧૨૩ કરિયાણા લેન<br/>માર્કેટ સિટી, એમસી ૧૨૩૪૫<br/>contact@freshmart.com</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-slate-200 mb-2 uppercase tracking-wider">ઇન્વૉઇસ</h2>
            <p className="text-slate-800 font-bold text-lg">{invoice.id}</p>
            <p className="text-slate-500 mb-2">{new Date(invoice.date).toLocaleString()}</p>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">બિલ મેળવનાર</h3>
          {invoice.customer ? (
            <>
              <p className="text-xl font-bold text-slate-800">{invoice.customer.shopName || invoice.customer.name}</p>
              {invoice.customer.shopName && <p className="text-slate-600 mt-1">{invoice.customer.name}</p>}
              {invoice.customer.address && <p className="text-slate-500">{invoice.customer.address}</p>}
              {invoice.customer.contact && <p className="text-slate-500">{invoice.customer.contact}</p>}
            </>
          ) : (
            <p className="text-lg font-medium text-slate-800">{invoice.customerName}</p>
          )}
        </div>

        <div className="overflow-x-auto mb-8 print:overflow-visible">
          <table className="w-full min-w-[500px]">
            <thead className="border-b-2 border-slate-800 text-slate-800">
              <tr>
                <th className="py-3 text-left font-bold">વસ્તુનું વર્ણન</th>
                <th className="py-3 text-center font-bold">જથ્થો</th>
                <th className="py-3 text-right font-bold">કિંમત</th>
                <th className="py-3 text-right font-bold">કુલ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4 text-slate-800">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-slate-500">{item.product.quantityCategory}</p>
                  </td>
                  <td className="py-4 text-center text-slate-600">{item.quantity}</td>
                  <td className="py-4 text-right text-slate-600">₹{item.product.price.toFixed(2)}</td>
                  <td className="py-4 text-right font-medium text-slate-800">₹{(item.quantity * item.product.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2 text-slate-600">
              <span>પેટા સરવાળો</span>
              <span>₹{invoice.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-200">
              <span>કર (0%)</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between py-4 text-xl font-bold text-slate-800">
              <span>કુલ</span>
              <span className="text-green-600">₹{invoice.total.toFixed(2)}</span>
            </div>
            {invoice.status !== 'Paid' && (
              <>
                <div className="flex justify-between py-2 text-slate-600 border-t border-slate-200">
                  <span>ચૂકવેલ રકમ</span>
                  <span>₹{(invoice.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-lg font-bold text-red-600">
                  <span>બાકી રકમ</span>
                  <span>₹{Math.max(0, invoice.total - (invoice.amountPaid || 0)).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-center" data-html2canvas-ignore>
          <p className="text-slate-500 text-sm">ફ્રેશમાર્ટ પર ખરીદી કરવા બદલ આભાર!</p>
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors print:hidden">
            <Printer className="w-4 h-4" /> ઇન્વૉઇસ પ્રિન્ટ કરો
          </button>
        </div>
      </div>
    </div>
  );
}

