import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";

export default async function MessagesPage() {
  if (!(await requireAdminPage())) redirect("/admin/login");

  const messages = await prisma.messageAudit.findMany({
    include: { contact: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <main className="shell">
      <AdminNav />
      <h1 className="title">Messages</h1>
      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="table">
          <thead><tr><th>Time</th><th>WhatsApp</th><th>Direction</th><th>Kind</th><th>Status</th><th>Template</th></tr></thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td>{m.createdAt.toLocaleString()}</td>
                <td>{m.contact.waId}</td>
                <td>{m.direction}</td>
                <td>{m.kind}</td>
                <td>{m.status ?? "—"}</td>
                <td>{m.templateName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
