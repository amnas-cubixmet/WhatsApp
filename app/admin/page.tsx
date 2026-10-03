import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { formatInr } from "@/lib/money";

export default async function AdminDashboard() {
  if (!(await requireAdminPage())) redirect("/admin/login");

  const [orders, customers, products, paid] = await Promise.all([
    prisma.order.count(),
    prisma.contact.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { totalPaise: true },
    }),
  ]);

  const recent = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <main className="shell">
      <AdminNav />
      <h1 className="title">Dashboard</h1>
      <p className="muted">WhatsApp-first store overview</p>

      <section className="grid" style={{ marginTop: 20 }}>
        <div className="card"><div className="muted">Orders</div><div className="metric">{orders}</div></div>
        <div className="card"><div className="muted">Customers</div><div className="metric">{customers}</div></div>
        <div className="card"><div className="muted">Active products</div><div className="metric">{products}</div></div>
        <div className="card"><div className="muted">Paid sales</div><div className="metric">{formatInr(paid._sum.totalPaise ?? 0)}</div></div>
      </section>

      <h2 style={{ marginTop: 28 }}>Recent orders</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{o.customerName}<br/><span className="muted">{o.phone}</span></td>
                <td>{formatInr(o.totalPaise)}</td>
                <td>{o.paymentStatus}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
