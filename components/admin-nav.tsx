export function AdminNav() {
  return (
    <nav className="nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/orders">Orders</a>
      <a href="/admin/customers">Customers</a>
      <a href="/admin/messages">Messages</a>
      <a href="/">Store Status</a>
    </nav>
  );
}
