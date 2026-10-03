export default function Home() {
  return (
    <main className="shell" style={{ maxWidth: 760, paddingTop: 64 }}>
      <div className="card stack">
        <div>
          <span className="pill">WhatsApp-first commerce</span>
          <h1 className="title" style={{ marginTop: 12 }}>Store backend is running</h1>
          <p className="muted">
            Customer shopping happens inside WhatsApp. This web app hosts the bot,
            webhooks, payments, database APIs and admin dashboard.
          </p>
        </div>

        <div className="grid2">
          <div className="card">
            <strong>Customer flow</strong>
            <p className="muted">Hi → Shop → Product → Cart → Address → Confirm → Pay → Order updates</p>
          </div>
          <div className="card">
            <strong>Admin</strong>
            <p className="muted">Products, stock, orders, customers and message logs.</p>
            <a className="btn" style={{ display: "inline-block" }} href="/admin">Open Admin</a>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          Health endpoint: <code>/api/health</code>
        </p>
      </div>
    </main>
  );
}
