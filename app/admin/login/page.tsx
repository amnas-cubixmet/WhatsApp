import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createAdminToken, verifyAdminToken } from "@/lib/admin-auth";

export default async function LoginPage() {
  const store = await cookies();
  if (verifyAdminToken(store.get(ADMIN_COOKIE)?.value)) redirect("/admin");

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      redirect("/admin/login?error=1");
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, createAdminToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/admin");
  }

  return (
    <main className="shell" style={{ maxWidth: 460, paddingTop: 80 }}>
      <div className="card stack">
        <div>
          <h1 className="title">Admin Login</h1>
          <p className="muted">WhatsApp Commerce</p>
        </div>
        <form action={login} className="stack">
          <input className="input" type="password" name="password" placeholder="Admin password" required />
          <button className="btn" type="submit">Login</button>
        </form>
      </div>
    </main>
  );
}
