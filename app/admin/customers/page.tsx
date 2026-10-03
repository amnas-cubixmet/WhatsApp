import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";

export default async function CustomersPage() {
  if (!(await requireAdminPage())) redirect("/admin/login");

  const contacts = await prisma.contact.findMany({
    include: { _count: { select: { orders: true, messages: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return (
    <main className="shell">
      <AdminNav />
      <h1 className="title">Customers</h1>
      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="table">
          <thead><tr><th>WhatsApp</th><th>Name</th><th>Consent</th><th>Last inbound</th><th>Orders</th><th>Messages</th></tr></thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>{c.waId}</td>
                <td>{c.displayName ?? "—"}</td>
                <td>{c.consentStatus}</td>
                <td>{c.lastInboundAt?.toLocaleString() ?? "—"}</td>
                <td>{c._count.orders}</td>
                <td>{c._count.messages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
