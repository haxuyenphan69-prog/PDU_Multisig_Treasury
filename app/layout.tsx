import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "PDU Multisig Treasury",
  description: "Kho quỹ XLM đồng thuận 3/3 minh bạch trên Stellar Testnet.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "PDU Multisig Treasury",
    description: "Một khoản chi. Ba người cùng quyết. Kho quỹ XLM 3/3 trên Stellar.",
    images: [{ url: "/og-3of3.png", width: 1536, height: 1024 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-3of3.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
