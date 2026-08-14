import type { Metadata } from "next";
import TreasuryApp from "./treasury-app";

export const metadata: Metadata = {
  title: "PDU Treasury — Quỹ đa chữ ký trên Stellar",
  description: "Quản trị quỹ XLM theo cơ chế đồng thuận bắt buộc 3/3 bằng Soroban.",
};

export default function Home() {
  return <TreasuryApp />;
}
