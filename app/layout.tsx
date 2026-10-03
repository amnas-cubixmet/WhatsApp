import "./globals.css";

export const metadata = {
  title: "WhatsApp Commerce",
  description: "WhatsApp-first commerce backend and admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
