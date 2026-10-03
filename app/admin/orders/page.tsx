import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { formatInr } from "@/lib/money";
import { notifyOrderStatus } from "@/lib/order-notify";

const statuses = [
  "PENDING_PAYMENT","CONFIRMED","PROCESSING","PACKED","SHIPPED",
  "OUT_FOR_DELIVERY","DELIVERED","CANCELLED"
];

export default async function OrdersPage() {
  if (!(await requireAdminPage())) redirect("/admin/login");

  async function updateStatus(formData: FormData) {
    "use server";
    if (!(await requireAdminPage())) redirect("/admin/login");
    const id = String(formData.get("id"));
    const status = String(formData.get("status"));
    if (!statuses.includes(status)) return;

    await prisma.order.update({
      where: { id },
      data: { status: status as any },
    });

    try { await notifyOrderStatus(id); } catch (e) { console.error(e); }
    revalidatePath("/admin/orders");
  }

  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="shell">
      <AdminNav />
      <h1 className="title">Orders</h1>
      <div className="stack" style={{ marginTop: 20 }}>
        {orders.map((o) => (
          <article className="card" key={o.id}>
            <div className="grid2">
              <div>
                <strong>{o.orderNumber}</strong>
                <p>{o.customerName} · {o.phone}</p>
                <p className="muted">{o.addressLine}, {o.pincode}</p>
                <div className="stack">
                  {o.items.map((item) => (
                    <div key={item.id}>{item.productName} × {item.quantity} — {formatInr(item.lineTotalPaise)}</div>
                  ))}
                </div>
              </div>
              <div>
                <p><strong>Total:</strong> {formatInr(o.totalPaise)}</p>
                <p><strong>Payment:</strong> {o.paymentStatus}</p>
                {o.razorpayLinkUrl ? <p><a href={o.razorpayLinkUrl} target="_blank">Payment link</a></p> : null}
                <form action={updateStatus} className="form-row">
                  <input type="hidden" name="id" value={o.id}/>
                  <select className="input" name="status" defaultValue={o.status}>
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn">Update</button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
