import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const DEPLOYED_TESTNET_CONTRACT_ID = "CAM5TLNZA3ETITVK7FWIVCE7XTLYDXLHCF75AVWEOODZCFQN5ZB4LMQB";
const CONTRACT_ID = process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID?.trim() || DEPLOYED_TESTNET_CONTRACT_ID;
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim() || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE?.trim() || Networks.TESTNET;
const XLM_SCALE = 10_000_000n;

export type ChainStatus = "Pending" | "Executed" | "Cancelled";
export type ChainProposal = {
  id: bigint;
  proposer: string;
  recipient: string;
  amount: bigint;
  memo: string;
  approvalCount: number;
  createdAtLedger: number;
  expiresAtLedger: number;
  status: ChainStatus;
  approvals: string[];
};
export type ChainSnapshot = {
  owners: string[];
  threshold: number;
  balance: bigint;
  latestLedger: number;
  proposals: ChainProposal[];
};

export const isChainConfigured = /^C[A-Z2-7]{55}$/.test(CONTRACT_ID);

function addressValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) return String(value);
  return "";
}

function enumValue(value: unknown): ChainStatus {
  const text = typeof value === "string" ? value : String(value);
  if (text.includes("Executed")) return "Executed";
  if (text.includes("Cancelled")) return "Cancelled";
  return "Pending";
}

async function simulate(method: string, params: xdr.ScVal[] = []): Promise<unknown> {
  if (!isChainConfigured) throw new Error("Chưa cấu hình Contract ID Testnet");
  const server = new rpc.Server(RPC_URL);
  const source = new (await import("@stellar/stellar-sdk")).Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
  const transaction = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(CONTRACT_ID).call(method, ...params))
    .setTimeout(30)
    .build();
  const result = await server.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
    throw new Error("RPC không đọc được trạng thái contract");
  }
  return scValToNative(result.result.retval);
}

function u64(value: bigint | number) {
  return nativeToScVal(BigInt(value), { type: "u64" });
}
function u32(value: number) {
  return nativeToScVal(value, { type: "u32" });
}
function i128(value: bigint) {
  return nativeToScVal(value, { type: "i128" });
}
function address(value: string) {
  return nativeToScVal(Address.fromString(value));
}

function transactionFailureMessage(result: unknown): string {
  const detail = JSON.stringify(result);
  // Error 17 is InsufficientTreasuryBalance in this contract. Keeping this
  // mapping here prevents raw Soroban diagnostic events from reaching users.
  if (detail.includes("#17") || detail.includes("InsufficientTreasuryBalance")) {
    return "Kho quỹ không đủ XLM để thực thi khoản chi này. Hãy nạp thêm XLM vào treasury rồi thử lại.";
  }
  return "Transaction bị contract từ chối. Hãy kiểm tra lại trạng thái proposal và số dư treasury rồi thử lại.";
}

async function submit(sourceAddress: string, method: string, params: xdr.ScVal[]) {
  if (!isChainConfigured) throw new Error("Chưa cấu hình Contract ID Testnet");
  const server = new rpc.Server(RPC_URL);
  const source = await server.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(CONTRACT_ID).call(method, ...params))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(transaction);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: sourceAddress,
  });
  if (signed.error) throw new Error(signed.error.message || "Freighter từ chối ký");
  const signedTransaction = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signedTransaction);
  if (sent.status === "ERROR") throw new Error("RPC từ chối transaction");
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== "SUCCESS") throw new Error(transactionFailureMessage(final));
  return sent.hash;
}

export async function loadChainSnapshot(): Promise<ChainSnapshot> {
  const rawConfig = await simulate("get_config") as Record<string, unknown>;
  const owners = (rawConfig.owners as unknown[]).map(addressValue);
  const threshold = Number(rawConfig.threshold);
  if (threshold !== owners.length) throw new Error("Contract không dùng đồng thuận toàn bộ owner");
  const [rawCount, rawBalance, latest] = await Promise.all([
    simulate("get_proposal_count"),
    simulate("treasury_balance"),
    new rpc.Server(RPC_URL).getLatestLedger(),
  ]);
  const count = Number(rawCount);
  const proposals = await Promise.all(Array.from({ length: Math.min(count, 50) }, async (_, index) => {
    const raw = await simulate("get_proposal", [u64(index)]) as Record<string, unknown>;
    const approvals = (await Promise.all(owners.map(async (owner) =>
      (await simulate("has_approved", [u64(index), address(owner)])) ? owner : ""
    ))).filter(Boolean);
    return {
      id: BigInt(raw.id as bigint),
      proposer: addressValue(raw.proposer),
      recipient: addressValue(raw.recipient),
      amount: BigInt(raw.amount as bigint),
      memo: String(raw.memo),
      approvalCount: Number(raw.approval_count),
      createdAtLedger: Number(raw.created_at_ledger),
      expiresAtLedger: Number(raw.expires_at_ledger),
      status: enumValue(raw.status),
      approvals,
    } satisfies ChainProposal;
  }));
  return { owners, threshold, balance: BigInt(rawBalance as bigint), latestLedger: latest.sequence, proposals: proposals.reverse() };
}

export function rawXlm(value: string): bigint {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 7) throw new Error("Số XLM không hợp lệ");
  return BigInt(whole) * XLM_SCALE + BigInt((fraction + "0000000").slice(0, 7));
}

export const chainActions = {
  createProposal(source: string, recipient: string, amount: string, memo: string, expiresAtLedger: number) {
    return submit(source, "create_proposal", [address(source), address(recipient), i128(rawXlm(amount)), nativeToScVal(memo, { type: "string" }), u32(expiresAtLedger)]);
  },
  approve(source: string, proposalId: bigint) {
    return submit(source, "approve", [address(source), u64(proposalId)]);
  },
  execute(source: string, proposalId: bigint) {
    return submit(source, "execute", [address(source), u64(proposalId)]);
  },
  deposit(source: string, amount: string) {
    return submit(source, "deposit", [address(source), i128(rawXlm(amount))]);
  },
};
