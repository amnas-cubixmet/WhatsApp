import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { formatInr } from "@/lib/money";

export default async function ProductsPage() {
  if (!(await requireAdminPage())) redirect("/admin/login");

  async function createCategory(formData: FormData) {
    "use server";
    if (!(await requireAdminPage())) redirect("/admin/login");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!name || !slug) return;
    await prisma.category.create({ data: { name, slug } });
    revalidatePath("/admin/products");
  }

  async function createProduct(formData: FormData) {
    "use server";
    if (!(await requireAdminPage())) redirect("/admin/login");
    await prisma.product.create({
      data: {
        name: String(formData.get("name") ?? "").trim(),
        sku: String(formData.get("sku") ?? "").trim() || null,
        categoryId: String(formData.get("categoryId") ?? "") || null,
        description: String(formData.get("description") ?? "").trim() || null,
        imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
        pricePaise: Math.round(Number(formData.get("price") ?? 0) * 100),
        stockQty: Math.max(0, Number(formData.get("stockQty") ?? 0)),
      },
    });
    revalidatePath("/admin/products");
  }

  async function toggleProduct(formData: FormData) {
    "use server";
    if (!(await requireAdminPage())) redirect("/admin/login");
    const id = String(formData.get("id"));
    const active = String(formData.get("active")) === "true";
    await prisma.product.update({ where: { id }, data: { active: !active } });
    revalidatePath("/admin/products");
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="shell">
      <AdminNav />
      <h1 className="title">Products</h1>

      <section className="grid2" style={{ marginTop: 20 }}>
        <form action={createCategory} className="card stack">
          <h2 style={{ margin: 0 }}>Add category</h2>
          <input className="input" name="name" placeholder="Category name" required />
          <input className="input" name="slug" placeholder="slug" required />
          <button className="btn">Add category</button>
        </form>

        <form action={createProduct} className="card stack">
          <h2 style={{ margin: 0 }}>Add product</h2>
          <div className="form-row">
            <input className="input" name="name" placeholder="Product name" required />
            <input className="input" name="sku" placeholder="SKU" />
          </div>
          <select className="input" name="categoryId" required>
            <option value="">Choose category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea className="input" name="description" placeholder="Description" />
          <input className="input" name="imageUrl" placeholder="Image URL (optional)" />
          <div className="form-row">
            <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Price ₹" required />
            <input className="input" name="stockQty" type="number" min="0" placeholder="Stock" required />
          </div>
          <button className="btn">Add product</button>
        </form>
      </section>

      <h2 style={{ marginTop: 28 }}>Catalog</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><br/><span className="muted">{p.sku ?? "No SKU"}</span></td>
                <td>{p.category?.name ?? "—"}</td>
                <td>{formatInr(p.pricePaise)}</td>
                <td>{p.stockQty}</td>
                <td><span className="pill">{p.active ? "Active" : "Hidden"}</span></td>
                <td>
                  <form action={toggleProduct}>
                    <input type="hidden" name="id" value={p.id}/>
                    <input type="hidden" name="active" value={String(p.active)}/>
                    <button className="btn secondary">{p.active ? "Hide" : "Activate"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
