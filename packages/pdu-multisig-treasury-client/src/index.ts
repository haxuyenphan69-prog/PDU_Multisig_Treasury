export const NETWORK = "TESTNET" as const;
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const XLM_SCALE = 10_000_000n;

export type ProposalStatus = "Pending" | "Executed" | "Cancelled";
export type TreasuryConfig = { owners: string[]; threshold: number; token: string; nextProposalId: bigint };
export type Proposal = { id: bigint; proposer: string; recipient: string; amount: bigint; memo: string; approvalCount: number; createdAtLedger: number; expiresAtLedger: number; status: ProposalStatus };

export enum TreasuryError {
  NoOwners=1, TooManyOwners, DuplicateOwner, InvalidThreshold, NotOwner,
  InvalidAmount, InvalidRecipient, MemoTooLong, InvalidExpiry, ProposalNotFound,
  AlreadyApproved, ProposalNotPending, ProposalExpired, NotEnoughApprovals,
  NotProposer, ThresholdAlreadyReached, InsufficientTreasuryBalance,
  ProposalIdOverflow, ApprovalCountOverflow,
}

export function xlmToRaw(value: string): bigint {
  const [whole="0", fraction=""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length>7) throw new Error("Số XLM không hợp lệ");
  return BigInt(whole)*XLM_SCALE+BigInt((fraction+"0000000").slice(0,7));
}
export function rawToXlm(value: bigint): string {
  const sign=value<0n?"-":""; const abs=value<0n?-value:value;
  const fraction=(abs%XLM_SCALE).toString().padStart(7,"0").replace(/0+$/,"");
  return `${sign}${abs/XLM_SCALE}${fraction?`.${fraction}`:""}`;
}
