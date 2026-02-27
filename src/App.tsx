import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import AdminLayout from "@/layouts/AdminLayout";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import ProductsPage from "@/pages/admin/ProductsPage";
import CategoriesPage from "@/pages/admin/CategoriesPage";
import ModifiersPage from "@/pages/admin/ModifiersPage";
import TablesPage from "@/pages/admin/TablesPage";
import CounterPage from "@/pages/restaurant/CounterPage";
import TablesMapPage from "@/pages/restaurant/TablesMapPage";
import TableTakeOrderPage from "@/pages/restaurant/TableTakeOrderPage";
import SalesPage from "@/pages/restaurant/SalesPage";
import DeliveryPage from "@/pages/restaurant/DeliveryPage";
import OnlineStoreSettingsPage from "@/pages/admin/OnlineStoreSettingsPage";
import TeamPage from "@/pages/admin/TeamPage";
import PrintersPage from "@/pages/admin/PrintersPage";
import GeneralSettingsPage from "@/pages/admin/GeneralSettingsPage";
import PaymentMethodsPage from "@/pages/admin/PaymentMethodsPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "./pages/NotFound";
import { CartProvider } from "@/contexts/CartContext";
import StorePage from "@/pages/store/StorePage";
import CheckoutPage from "@/pages/store/CheckoutPage";
import { AudioAlertProvider } from "@/components/AudioAlertProvider";

function RoleRedirect() {
  const { role } = useAuth();
  const dest = role === "admin" ? "/restaurant/counter" : "/restaurant/tables";
  return <Navigate to={dest} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <AudioAlertProvider>
              <Routes>
                <Route path="/menu" element={<StorePage />} />
                <Route path="/menu/checkout" element={<CheckoutPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <RoleRedirect />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="products" replace />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="modifiers" element={<ModifiersPage />} />
                  <Route path="tables" element={<TablesPage />} />
                  <Route path="sales" element={<SalesPage />} />
                  <Route path="online-store" element={<OnlineStoreSettingsPage />} />
                  <Route path="team" element={<TeamPage />} />
                  <Route path="printers" element={<PrintersPage />} />
                  <Route path="payment-methods" element={<PaymentMethodsPage />} />
                  <Route path="settings" element={<GeneralSettingsPage />} />
                </Route>
                <Route
                  path="/restaurant"
                  element={
                    <ProtectedRoute>
                      <RestaurantLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="counter" replace />} />
                  <Route path="counter" element={<CounterPage />} />
                  <Route path="counter/:orderId/take-order" element={<TableTakeOrderPage />} />
                  <Route path="tables" element={<TablesMapPage />} />
                  <Route path="tables/:orderId/take-order" element={<TableTakeOrderPage />} />
                  <Route path="delivery" element={<DeliveryPage />} />
                  <Route path="delivery/:orderId/take-order" element={<TableTakeOrderPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AudioAlertProvider>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
