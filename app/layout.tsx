import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "PDU Multisig Treasury",
  description: "Kho quỹ XLM 2/3 minh bạch trên Stellar Testnet.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "PDU Multisig Treasury",
    description: "Tiền chung. Quyết định chung. Kho quỹ XLM 2/3 trên Stellar.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
