import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './lib/cart';
import DemoBanner from './components/DemoBanner';
import Cart from './pages/Cart';
import Catalog from './pages/Catalog';
import Checkout from './pages/Checkout';
import CompanyPanel from './pages/CompanyPanel';
import Favorites from './pages/Favorites';
import Help from './pages/Help';
import Home from './pages/Home';
import Login from './pages/Login';
import LotDetail from './pages/LotDetail';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import OrderDetail from './pages/OrderDetail';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Register from './pages/Register';
import AdminCatalogs from './pages/admin/AdminCatalogs';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminInventory from './pages/admin/AdminInventory';
import AdminLotForm from './pages/admin/AdminLotForm';
import AdminLots from './pages/admin/AdminLots';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminOrders from './pages/admin/AdminOrders';
import AdminPackages from './pages/admin/AdminPackages';
import AdminReports from './pages/admin/AdminReports';
import AdminUsers from './pages/admin/AdminUsers';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <DemoBanner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/lotes/:id" element={<LotDetail />} />
            <Route path="/carrito" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/pedidos/:id" element={<OrderDetail />} />
            <Route path="/favoritos" element={<Favorites />} />
            <Route path="/cuenta" element={<Profile />} />
            <Route path="/ayuda" element={<Help />} />
            <Route path="/notificaciones" element={<Notifications />} />
            <Route path="/mensajes" element={<Messages />} />
            <Route path="/empresa" element={<CompanyPanel />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/lotes" element={<AdminLots />} />
            <Route path="/admin/lotes/nuevo" element={<AdminLotForm />} />
            <Route path="/admin/lotes/:id" element={<AdminLotForm />} />
            <Route path="/admin/inventario" element={<AdminInventory />} />
            <Route path="/admin/paquetes" element={<AdminPackages />} />
            <Route path="/admin/pedidos" element={<AdminOrders />} />
            <Route path="/admin/pedidos/:id" element={<AdminOrderDetail />} />
            <Route path="/admin/empresas" element={<AdminCompanies />} />
            <Route path="/admin/usuarios" element={<AdminUsers />} />
            <Route path="/admin/catalogos" element={<AdminCatalogs />} />
            <Route path="/admin/reportes" element={<AdminReports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
