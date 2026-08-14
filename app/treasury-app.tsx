"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  FilePlus2,
  Fingerprint,
  KeyRound,
  Landmark,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Networks } from "@stellar/stellar-sdk";
import { chainActions, isChainConfigured, loadChainSnapshot, type ChainSnapshot } from "./stellar-treasury";

type OwnerName = "Owner 01" | "Owner 02" | "Owner 03";
type Status = "pending" | "ready" | "executed" | "cancelled" | "expired";
type Proposal = {
  id: number;
  title: string;
  memo: string;
  recipient: string;
  amount: number;
  approvals: OwnerName[];
  status: Status;
  created: string;
  expires: string;
  proposer: OwnerName;
  executedAt?: string;
};
type ActivityItem = { id: string; actor: OwnerName; action: string; detail: string; time: string };
type Session = { address: string; owner: OwnerName };

const OWNER_NAMES: OwnerName[] = ["Owner 01", "Owner 02", "Owner 03"];
const OWNER_META: Record<OwnerName, { role: string; number: string }> = {
  "Owner 01": { role: "Khởi tạo & phê duyệt", number: "01" },
  "Owner 02": { role: "Kiểm soát độc lập", number: "02" },
  "Owner 03": { role: "Đồng thuận cuối", number: "03" },
};
const PREVIEW_ADDRESSES: Record<OwnerName, string> = {
  "Owner 01": "GAKQ4...2FME",
  "Owner 02": "GC7BW...P3AA",
  "Owner 03": "GB3PH...09KD",
};
const EMPTY_ADDRESSES: Record<OwnerName, string> = {
  "Owner 01": "",
  "Owner 02": "",
  "Owner 03": "",
};
const PREVIEW_PROPOSALS: Proposal[] = [
  {
    id: 4,
    title: "Tài trợ Demo Day mùa thu",
    memo: "Ngân sách sân khấu, âm thanh và truyền thông cho Demo Day PDU.",
    recipient: "GDAV4...KQ9M",
    amount: 280,
    approvals: ["Owner 01", "Owner 02"],
    status: "pending",
    created: "13 Thg 8",
    expires: "Còn 5 ngày",
    proposer: "Owner 01",
  },
  {
    id: 3,
    title: "Gia hạn máy chủ cộng đồng",
    memo: "Chi phí hạ tầng ba tháng cho cổng sinh viên.",
    recipient: "GBH8K...7R2P",
    amount: 85.5,
    approvals: [],
    status: "pending",
    created: "12 Thg 8",
    expires: "Còn 3 ngày",
    proposer: "Owner 03",
  },
  {
    id: 2,
    title: "Học bổng Stellar Bootcamp",
    memo: "Hỗ trợ năm sinh viên hoàn thành chương trình Soroban.",
    recipient: "GCGQ9...L5TX",
    amount: 500,
    approvals: OWNER_NAMES,
    status: "executed",
    created: "04 Thg 8",
    expires: "Đã thực thi",
    proposer: "Owner 01",
    executedAt: "04 Thg 8 · 16:42",
  },
];
const PREVIEW_ACTIVITY: ActivityItem[] = [
  { id: "a1", actor: "Owner 02", action: "đã ký", detail: "Đề xuất #04", time: "10:46" },
  { id: "a2", actor: "Owner 01", action: "đã tạo", detail: "Đề xuất #04", time: "09:30" },
  { id: "a3", actor: "Owner 03", action: "đã thực thi", detail: "Đề xuất #02", time: "04 Thg 8" },
];
const LABEL: Record<Status, string> = {
  pending: "Đang ký",
  ready: "Đủ 3 chữ ký",
  executed: "Đã giải ngân",
  cancelled: "Đã huỷ",
  expired: "Hết hạn",
};
const fmt = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const shortAddress = (address: string) => address.length > 14 ? `${address.slice(0, 7)}...${address.slice(-5)}` : address;

function mapSnapshot(snapshot: ChainSnapshot) {
  if (snapshot.owners.length !== 3 || snapshot.threshold !== 3) {
    throw new Error("Contract phải có đúng 3 owner và ngưỡng đồng thuận 3/3");
  }
  const addresses = Object.fromEntries(
    OWNER_NAMES.map((name, index) => [name, snapshot.owners[index]]),
  ) as Record<OwnerName, string>;
  const ownerFor = (address: string): OwnerName => {
    const owner = OWNER_NAMES.find((name) => addresses[name] === address);
    if (!owner) throw new Error(`Địa chỉ ${shortAddress(address)} không thuộc cấu hình owner`);
    return owner;
  };
  const proposals = snapshot.proposals.map((proposal) => {
    const [title, ...memoParts] = proposal.memo.split(": ");
    const approvals = proposal.approvals.map(ownerFor);
    const expired = snapshot.latestLedger >= proposal.expiresAtLedger;
    const status: Status = proposal.status === "Executed"
      ? "executed"
      : proposal.status === "Cancelled"
        ? "cancelled"
        : expired
          ? "expired"
          : approvals.length === 3
            ? "ready"
            : "pending";
    return {
      id: Number(proposal.id),
      title: title || `Đề xuất #${proposal.id}`,
      memo: memoParts.join(": ") || proposal.memo,
      recipient: proposal.recipient,
      amount: Number(proposal.amount) / 10_000_000,
      approvals,
      status,
      created: `Ledger ${proposal.createdAtLedger.toLocaleString("vi-VN")}`,
      expires: expired ? "Đã hết hạn" : `Còn ${proposal.expiresAtLedger - snapshot.latestLedger} ledger`,
      proposer: ownerFor(proposal.proposer),
    } satisfies Proposal;
  });
  const activity = proposals.flatMap((proposal) => proposal.approvals.map((actor) => ({
    id: `chain-${proposal.id}-${actor}`,
    actor,
    action: "đã ký on-chain",
    detail: `Đề xuất #${String(proposal.id).padStart(2, "0")}`,
    time: proposal.created,
  }))).slice(0, 8);
  return { addresses, proposals, activity };
}

export default function TreasuryApp() {
  const [proposals, setProposals] = useState<Proposal[]>(isChainConfigured ? [] : PREVIEW_PROPOSALS);
  const [ownerAddresses, setOwnerAddresses] = useState(isChainConfigured ? EMPTY_ADDRESSES : PREVIEW_ADDRESSES);
  const [activity, setActivity] = useState<ActivityItem[]>(isChainConfigured ? [] : PREVIEW_ACTIVITY);
  const [balance, setBalance] = useState(isChainConfigured ? 0 : 1842.75);
  const [latestLedger, setLatestLedger] = useState(0);
  const [selectedId, setSelectedId] = useState(isChainConfigured ? 0 : 4);
  const [session, setSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "closed">("all");
  const [modal, setModal] = useState<"create" | "deposit" | "sign" | "execute" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 4200);
  }, []);

  const applyLiveSnapshot = useCallback((snapshot: ChainSnapshot) => {
    const mapped = mapSnapshot(snapshot);
    setOwnerAddresses(mapped.addresses);
    setProposals(mapped.proposals);
    setActivity(mapped.activity);
    setBalance(Number(snapshot.balance) / 10_000_000);
    setLatestLedger(snapshot.latestLedger);
    setSelectedId((current) => mapped.proposals.some((item) => item.id === current)
      ? current
      : mapped.proposals[0]?.id ?? 0);
    return mapped;
  }, []);

  const syncChain = useCallback(async () => {
    if (!isChainConfigured) {
      notify("Preview chỉ đọc — cần Contract ID Testnet để đồng bộ dữ liệu thật");
      return;
    }
    setSyncing(true);
    try {
      const snapshot = await loadChainSnapshot();
      const mapped = applyLiveSnapshot(snapshot);
      setSession((current) => {
        if (!current) return null;
        const owner = OWNER_NAMES.find((name) => mapped.addresses[name] === current.address);
        if (!owner) {
          notify("Ví hiện tại không còn thuộc danh sách owner của contract");
          return null;
        }
        return { ...current, owner };
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không đồng bộ được Soroban RPC");
    } finally {
      setSyncing(false);
    }
  }, [applyLiveSnapshot, notify]);

  useEffect(() => {
    if (!isChainConfigured) return;
    const timer = window.setTimeout(() => void syncChain(), 0);
    return () => window.clearTimeout(timer);
  }, [syncChain]);

  useEffect(() => {
    if (!isChainConfigured || !session) return;
    let watcher: { stop: () => void } | undefined;
    let cancelled = false;
    void import("@stellar/freighter-api").then(({ WatchWalletChanges }) => {
      if (cancelled) return;
      watcher = new WatchWalletChanges(1200);
      watcher.watch(({ address, networkPassphrase, error }) => {
        if (error || !address) return;
        if (address !== session.address || networkPassphrase !== Networks.TESTNET) {
          setSession(null);
          setModal(null);
          notify("Freighter đã đổi tài khoản hoặc mạng. Hãy bấm Kết nối lại để xác minh owner mới.");
        }
      });
    });
    return () => {
      cancelled = true;
      watcher?.stop();
    };
  }, [notify, session]);

  const active = proposals.find((proposal) => proposal.id === selectedId) ?? proposals[0] ?? (isChainConfigured ? undefined : PREVIEW_PROPOSALS[0]);
  const waitingForCurrent = session
    ? proposals.filter((proposal) => proposal.status === "pending" && !proposal.approvals.includes(session.owner))
    : [];
  const visible = useMemo(() => proposals.filter((proposal) => {
    if (filter === "mine") return Boolean(session) && proposal.status === "pending" && !proposal.approvals.includes(session!.owner);
    if (filter === "closed") return ["executed", "cancelled", "expired"].includes(proposal.status);
    return true;
  }), [filter, proposals, session]);

  const requireLiveSession = useCallback((nextModal: "create" | "deposit" | "sign" | "execute") => {
    if (!isChainConfigured) {
      notify("Chế độ preview không thể tạo hoặc ký. Hãy deploy contract và cấu hình Contract ID trước.");
      return;
    }
    if (!session) {
      notify("Hãy kết nối đúng một trong ba ví owner bằng Freighter trước.");
      return;
    }
    setModal(nextModal);
  }, [notify, session]);

  async function connectWallet() {
    if (!isChainConfigured) {
      notify("Trang đang ở Preview chỉ đọc vì chưa có NEXT_PUBLIC_TREASURY_CONTRACT_ID");
      return;
    }
    setSyncing(true);
    try {
      const { getNetworkDetails, isConnected, requestAccess } = await import("@stellar/freighter-api");
      const connection = await Promise.race([
        isConnected(),
        new Promise<never>((_, reject) => window.setTimeout(
          () => reject(new Error("Freighter không phản hồi. Hãy kiểm tra extension rồi thử lại.")),
          3_000,
        )),
      ]);
      if (connection.error || !connection.isConnected) {
        throw new Error("Không tìm thấy Freighter. Hãy cài extension Freighter rồi mở lại trang này.");
      }
      const access = await requestAccess();
      if (access.error) throw new Error(access.error.message || "Freighter từ chối kết nối");
      const network = await getNetworkDetails();
      if (network.error) throw new Error(network.error.message || "Không đọc được mạng Freighter");
      if (network.networkPassphrase !== Networks.TESTNET) {
        throw new Error("Freighter đang ở sai mạng. Hãy chuyển sang Testnet rồi kết nối lại.");
      }
      const snapshot = await loadChainSnapshot();
      const mapped = applyLiveSnapshot(snapshot);
      const owner = OWNER_NAMES.find((name) => mapped.addresses[name] === access.address);
      if (!owner) throw new Error("Ví này không thuộc ba owner của treasury contract");
      setSession({ address: access.address, owner });
      notify(`${owner} đã được xác minh bằng Freighter trên Testnet`);
    } catch (error) {
      setSession(null);
      notify(error instanceof Error ? error.message : "Không kết nối được Freighter");
    } finally {
      setSyncing(false);
    }
  }

  function disconnectSession() {
    setSession(null);
    setModal(null);
    setFilter("all");
    notify("Đã ngắt phiên trong DApp. Bạn có thể đổi tài khoản trong Freighter rồi kết nối lại.");
  }

  async function confirmSign() {
    if (!session || !active || !isChainConfigured || active.status !== "pending" || active.approvals.includes(session.owner)) return;
    setSyncing(true);
    try {
      await chainActions.approve(session.address, BigInt(active.id));
      setModal(null);
      notify(`${session.owner} đã ký proposal #${String(active.id).padStart(2, "0")} trên Testnet`);
      await syncChain();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Ký transaction thất bại");
    } finally {
      setSyncing(false);
    }
  }

  async function confirmExecute() {
    if (!session || !active || !isChainConfigured || active.status !== "ready" || active.approvals.length !== 3) return;
    if (balance < active.amount) {
      setModal(null);
      notify(`Kho quỹ chỉ có ${fmt(balance)} XLM, chưa đủ ${fmt(active.amount)} XLM để thực thi. Hãy nạp quỹ trước.`);
      return;
    }
    setSyncing(true);
    try {
      await chainActions.execute(session.address, BigInt(active.id));
      setModal(null);
      notify("Khoản chi đã được thực thi trên Stellar Testnet");
      await syncChain();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Thực thi transaction thất bại");
    } finally {
      setSyncing(false);
    }
  }

  async function submitProposal(data: Record<string, string>) {
    if (!session || !isChainConfigured) return;
    const memo = `${data.title}: ${data.memo}`;
    if (new TextEncoder().encode(memo).length > 160) {
      notify("Tiêu đề và mục đích vượt giới hạn 160 UTF-8 bytes");
      return;
    }
    setSyncing(true);
    try {
      await chainActions.createProposal(session.address, data.recipient, data.amount, memo, latestLedger + 120_000);
      setModal(null);
      notify("Đề xuất đã được tạo ở trạng thái 0/3; từng owner phải mở và xác nhận riêng");
      await syncChain();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Tạo đề xuất thất bại");
    } finally {
      setSyncing(false);
    }
  }

  async function submitDeposit(amount: string) {
    if (!session || !isChainConfigured) return;
    setSyncing(true);
    try {
      await chainActions.deposit(session.address, amount);
      setModal(null);
      notify("Đã nạp XLM vào treasury contract");
      await syncChain();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Nạp quỹ thất bại");
    } finally {
      setSyncing(false);
    }
  }

  async function copyRecipient() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.recipient);
      notify("Đã sao chép địa chỉ người nhận");
    } catch {
      notify("Trình duyệt không cho phép sao chép tự động");
    }
  }

  return <div className="treasury-app" id="top">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-seal"><Landmark /></span><span><b>PDU</b><em>Treasury</em></span></a>
      <nav className={navOpen ? "nav open" : "nav"}>
        <a href="#overview">Tổng quan</a><a href="#session">Phiên ký</a><a href="#proposals">Đề xuất</a><a href="#activity">Nhật ký</a>
      </nav>
      <div className="top-actions">
        <span className={`network-pill ${isChainConfigured ? "live" : "preview"}`}><i />{isChainConfigured ? "TESTNET LIVE" : "READ-ONLY PREVIEW"}</span>
        {session
          ? <button className="wallet-button connected" onClick={disconnectSession}><BadgeCheck /><span>{session.owner}<small>{shortAddress(session.address)}</small></span><LogOut /></button>
          : <button className="wallet-button" onClick={() => void connectWallet()} disabled={syncing}><Wallet />{syncing ? "Đang xác minh..." : "Kết nối Freighter"}</button>}
        <button className="menu-button" onClick={() => setNavOpen(!navOpen)} aria-label="Mở menu"><Menu /></button>
      </div>
    </header>

    <main>
      <section className="hero" id="overview">
        <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck /> Stellar Testnet · Unanimous treasury</span>
          <h1>Ba ví độc lập.<br/><em>Một quyết định hợp lệ.</em></h1>
          <p>Mỗi owner dùng tài khoản Freighter riêng. Proposal chỉ được mở khoá sau ba transaction xác nhận thật được contract ghi nhận on-chain.</p>
          <div className="hero-actions">
            <button onClick={() => requireLiveSession("create")}><FilePlus2 /> Tạo khoản chi</button>
            <button className="ghost" onClick={() => document.querySelector("#proposals")?.scrollIntoView()}><Fingerprint /> Mở hồ sơ ký</button>
          </div>
        </div>
        <div className="protocol-card">
          <div className="protocol-top"><span>PROTOCOL / 03 SIGNERS</span><LockKeyhole /></div>
          <div className="protocol-score"><strong>3</strong><i /><strong>3</strong></div>
          <h2>Không đủ ba ví,<br/>không thể chuyển tiền.</h2>
          <div className="protocol-route">{OWNER_NAMES.map((name, index) => <div key={name}><OwnerAvatar name={name}/><span><b>{OWNER_META[name].number}</b><small>{index === 0 ? "CREATE" : "APPROVE"}</small></span>{index < 2 && <ArrowRight />}</div>)}</div>
          <small className="contract-rule"><Zap /> `require_auth()` xác minh đúng địa chỉ ở mỗi lần ký</small>
        </div>
      </section>

      {!isChainConfigured && <section className="configuration-banner">
        <div><CircleAlert /><span><b>Frontend đang ở chế độ xem trước an toàn</b><small>Không có chữ ký giả, không thay đổi dữ liệu mẫu và không tạo transaction.</small></span></div>
        <p>Deploy contract với ba địa chỉ G..., thêm <code>NEXT_PUBLIC_TREASURY_CONTRACT_ID</code>, rồi khởi động lại ứng dụng để bật luồng ký thật.</p>
      </section>}

      <section className="metrics-grid">
        <article className="balance-card"><div><span>TÀI SẢN TREASURY</span><button onClick={() => void syncChain()} aria-label="Đồng bộ"><RefreshCw className={syncing ? "spin" : ""}/></button></div><strong>{fmt(balance)} <small>XLM</small></strong><footer><span><i />{isChainConfigured ? `Ledger ${latestLedger.toLocaleString("vi-VN")}` : "Dữ liệu minh hoạ"}</span><button onClick={() => requireLiveSession("deposit")}><ArrowDownToLine /> Nạp quỹ</button></footer></article>
        <article><span>Đang chờ đủ chữ ký</span><strong>{proposals.filter((p) => p.status === "pending").length}</strong><small><Clock3 /> Yêu cầu chưa đạt 3/3</small></article>
        <article><span>Sẵn sàng thực thi</span><strong>{proposals.filter((p) => p.status === "ready").length}</strong><small><CheckCircle2 /> Đã đồng thuận tuyệt đối</small></article>
        <article><span>Việc của phiên hiện tại</span><strong>{session ? waitingForCurrent.length : "—"}</strong><small><KeyRound /> {session ? `${session.owner} chưa ký` : "Chưa kết nối owner"}</small></article>
      </section>

      <section className="session-section" id="session">
        <div className="session-copy"><span className="section-label">SIGNING SESSION</span><h2>Mỗi lần kết nối chỉ đại diện cho một ví.</h2><p>Proposal mới luôn bắt đầu ở 0/3. Mỗi owner phải kết nối Freighter, mở đúng khoản chi và chủ động bấm xác nhận; chỉ transaction approve thành công mới được tính là một chữ ký.</p><ol><li><b>01</b><span>Tạo proposal ở trạng thái 0/3<small>Người tạo chưa được tính là đã xác nhận.</small></span></li><li><b>02</b><span>Từng owner mở khoản chi và ký<small>Mỗi tài khoản chỉ được tăng đúng một approval.</small></span></li><li><b>03</b><span>Đạt 3/3 rồi thực thi<small>Một owner gửi transaction execute cuối cùng.</small></span></li></ol></div>
        <div className={`session-console ${session ? "authenticated" : ""}`}>
          <div className="console-head"><span>ACTIVE WALLET SESSION</span>{session ? <BadgeCheck /> : <Unplug />}</div>
          {session ? <><div className="session-identity"><OwnerAvatar name={session.owner}/><span><small>ĐÃ XÁC MINH OWNER</small><strong>{session.owner}</strong><code>{session.address}</code></span></div><div className="session-network"><span><i />Stellar Testnet</span><span>Quyền ký: <b>1 ví</b></span></div><button className="disconnect-button" onClick={disconnectSession}><LogOut /> Ngắt phiên để đổi tài khoản</button></> : <><div className="empty-session"><Wallet /><strong>Chưa có owner được xác minh</strong><p>{isChainConfigured ? "Mở Freighter bằng một trong ba tài khoản owner rồi kết nối." : "Cần cấu hình Contract ID trước khi xác minh owner."}</p></div><button className="connect-large" onClick={() => void connectWallet()} disabled={!isChainConfigured || syncing}><Wallet /> Kết nối một ví Freighter <ArrowRight /></button></>}
        </div>
      </section>

      <section className="owner-roster">
        <div className="roster-heading"><span className="section-label">CONTRACT OWNER ROSTER</span><h2>Ba quyền ký tách biệt</h2><p>Danh sách này được đọc từ cấu hình contract và chỉ để đối chiếu — không phải nút chuyển vai trò.</p></div>
        <div className="roster-grid">{OWNER_NAMES.map((name) => <article key={name} className={session?.owner === name ? "current" : ""}><header><span>{OWNER_META[name].number}</span>{session?.owner === name ? <BadgeCheck /> : <ShieldCheck />}</header><h3>{name}</h3><p>{OWNER_META[name].role}</p><code>{shortAddress(ownerAddresses[name])}</code><footer>{session?.owner === name ? <><i /> Phiên hiện tại</> : "Owner độc lập"}</footer></article>)}</div>
      </section>

      <section className="signing-room" id="proposals">
        <div className="proposal-panel">
          <div className="section-head"><div><span className="section-label">SHARED SIGNING LEDGER</span><h2>Hồ sơ khoản chi</h2></div><button className="new-proposal" onClick={() => requireLiveSession("create")}><Plus /> Tạo mới</button></div>
          <div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả <b>{proposals.length}</b></button><button disabled={!session} className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>Chờ tôi ký <b>{waitingForCurrent.length}</b></button><button className={filter === "closed" ? "active" : ""} onClick={() => setFilter("closed")}>Đã đóng</button></div>
          <div className="proposal-list">{visible.length ? visible.map((proposal) => <button key={proposal.id} className={selectedId === proposal.id ? "proposal-row selected" : "proposal-row"} onClick={() => setSelectedId(proposal.id)}><span className={`status-dot ${proposal.status}`} /><span className="proposal-title"><b>#{String(proposal.id).padStart(2, "0")} · {proposal.title}</b><small>{proposal.recipient} · {proposal.created}</small></span><span className="mini-signatures">{OWNER_NAMES.map((name) => <i key={name} className={proposal.approvals.includes(name) ? "signed" : ""}>{proposal.approvals.includes(name) ? <Check /> : OWNER_META[name].number}</i>)}</span><span className="approval-count"><b>{proposal.approvals.length}/3</b><small>chữ ký</small></span><span className="proposal-value"><b>{fmt(proposal.amount)}</b><small>XLM</small></span><span className={`status-badge ${proposal.status}`}>{LABEL[proposal.status]}</span><ChevronRight /></button>) : <div className="empty-list"><Fingerprint /><span>Không có proposal phù hợp bộ lọc.</span></div>}</div>
        </div>

        <aside className="approval-panel">
          {active ? <>
          <div className="detail-kicker"><span>PROPOSAL / {String(active.id).padStart(2, "0")}</span><span className={`status-badge ${active.status}`}>{LABEL[active.status]}</span></div>
          <h2>{active.title}</h2><p className="detail-memo">{active.memo}</p>
          <div className="amount-callout"><span>SỐ TIỀN ĐỀ NGHỊ</span><strong>{fmt(active.amount)} <small>XLM</small></strong></div>
          <dl><div><dt>Người nhận</dt><dd>{shortAddress(active.recipient)}<button className="copy-address" type="button" aria-label="Sao chép địa chỉ" onClick={() => void copyRecipient()}><Copy /></button></dd></div><div><dt>Người tạo</dt><dd>{active.proposer}</dd></div><div><dt>Thời hạn</dt><dd>{active.expires}</dd></div></dl>
          <div className="approval-progress"><div><span>TIẾN ĐỘ ĐỒNG THUẬN</span><b>{active.approvals.length}/3 chữ ký</b></div><div className="progress-track"><i style={{ width: `${active.approvals.length / 3 * 100}%` }} /></div></div>
          <div className="signer-list">{OWNER_NAMES.map((name) => { const signed = active.approvals.includes(name); const current = session?.owner === name; return <div key={name} className={current ? "current" : ""}><OwnerAvatar name={name} signed={signed}/><span><b>{name}{current && <em>Phiên này</em>}</b><small>{shortAddress(ownerAddresses[name])}</small></span><strong className={signed ? "signed-text" : "waiting-text"}>{signed ? "Đã ký" : "Chưa ký"}</strong></div>; })}</div>
          <ApprovalAction proposal={active} session={session} configured={isChainConfigured} treasuryBalance={balance} openSign={() => requireLiveSession("sign")} openExecute={() => requireLiveSession("execute")} />
          </> : <div className="empty-list"><Fingerprint /><span>Chưa có proposal on-chain. Kết nối owner rồi tạo khoản chi đầu tiên.</span></div>}
        </aside>
      </section>

      <section className="audit-section" id="activity"><div className="audit-copy"><span className="section-label">ON-CHAIN AUDIT TRAIL</span><h2>Mỗi chữ ký là một transaction riêng.</h2><p>Ba ví không chia sẻ secret key. Frontend chỉ dựng transaction; Freighter của từng owner mới là nơi người dùng kiểm tra và ký.</p><div className="security-note"><ShieldCheck /><span>Trạng thái chung nằm trong Soroban contract. Khi owner thứ hai hoặc thứ ba kết nối, họ đọc đúng proposal và các approval đã được ghi trước đó.</span></div></div><div className="activity-feed">{activity.map((item) => <article key={item.id}><OwnerAvatar name={item.actor}/><span><b>{item.actor} {item.action}</b><small>{item.detail}</small></span><time>{item.time}</time></article>)}</div></section>
    </main>

    <footer className="site-footer"><span>PDU Multisig Treasury</span><span>Soroban · 3/3 unanimous approval · Testnet</span><a href="https://developers.stellar.org/" target="_blank" rel="noreferrer">Stellar Docs <ExternalLink /></a></footer>

    {modal === "create" && session && <ProposalModal owner={session.owner} close={() => setModal(null)} submit={submitProposal} />}
    {modal === "deposit" && <DepositModal close={() => setModal(null)} submit={submitDeposit} />}
    {modal === "sign" && session && active && <ConfirmModal kind="sign" proposal={active} session={session} close={() => setModal(null)} confirm={() => void confirmSign()} />}
    {modal === "execute" && session && active && <ConfirmModal kind="execute" proposal={active} session={session} close={() => setModal(null)} confirm={() => void confirmExecute()} />}
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </div>;
}

function OwnerAvatar({ name, signed = false }: { name: OwnerName; signed?: boolean }) {
  return <i className={`owner-avatar ${signed ? "signed" : ""}`}>{signed ? <Check /> : OWNER_META[name].number}</i>;
}

function ApprovalAction({ proposal, session, configured, treasuryBalance, openSign, openExecute }: { proposal: Proposal; session: Session | null; configured: boolean; treasuryBalance: number; openSign: () => void; openExecute: () => void }) {
  if (!configured) return <div className="action-state preview"><LockKeyhole /><span><b>Preview chỉ đọc</b><small>Cấu hình Contract ID để bật chữ ký thật.</small></span></div>;
  if (!session) return <div className="action-state muted"><Wallet /><span><b>Chưa có phiên owner</b><small>Kết nối Freighter để kiểm tra quyền ký.</small></span></div>;
  if (proposal.status === "executed") return <div className="action-state success"><CheckCircle2 /><span><b>Khoản chi đã hoàn tất</b><small>{proposal.executedAt ?? "Đã xác nhận trên ledger"}</small></span></div>;
  if (["cancelled", "expired"].includes(proposal.status)) return <div className="action-state muted"><CircleAlert /><span><b>Đề xuất đã đóng</b><small>Không thể thêm chữ ký hoặc thực thi.</small></span></div>;
  if (proposal.status === "ready" && treasuryBalance < proposal.amount) return <div className="action-state muted"><CircleAlert /><span><b>Đủ 3/3 nhưng kho quỹ chưa đủ XLM</b><small>Cần {fmt(proposal.amount)} XLM; hiện có {fmt(treasuryBalance)} XLM. Nạp quỹ trước khi thực thi.</small></span></div>;
  if (proposal.status === "ready") return <button className="approval-action execute" onClick={openExecute}><Fingerprint /><span><b>Thực thi khoản chi</b><small>Đủ 3/3 — gửi transaction chuyển tiền</small></span><ArrowRight /></button>;
  if (proposal.approvals.includes(session.owner)) return <div className="action-state signed"><CheckCircle2 /><span><b>Ví này đã ký</b><small>Đổi tài khoản Freighter để owner tiếp theo xác nhận.</small></span></div>;
  return <button className="approval-action" onClick={openSign}><KeyRound /><span><b>Ký bằng {session.owner}</b><small>Freighter sẽ yêu cầu xác nhận transaction {proposal.approvals.length + 1}/3</small></span><ArrowRight /></button>;
}

function ProposalModal({ owner, close, submit }: { owner: OwnerName; close: () => void; submit: (data: Record<string, string>) => void }) {
  const [data, setData] = useState({ title: "", memo: "", recipient: "", amount: "" });
  const totalBytes = new TextEncoder().encode(`${data.title}: ${data.memo}`).length;
  return <ModalShell close={close}><form onSubmit={(event) => { event.preventDefault(); if (totalBytes <= 160) void submit(data); }}><ModalHeader eyebrow={`Người tạo · ${owner}`} title="Tạo khoản chi mới" close={close}/><div className="form-grid"><label className="full">Tên khoản chi<input required value={data.title} onChange={(event) => setData({ ...data, title: event.target.value })} placeholder="Ví dụ: Tài trợ cuộc thi sinh viên" /></label><label>Người nhận<input required pattern="G[A-Z2-7]{55}" value={data.recipient} onChange={(event) => setData({ ...data, recipient: event.target.value })} placeholder="Địa chỉ G..." /></label><label>Số lượng XLM<input required min="0.0000001" step="0.0000001" type="number" value={data.amount} onChange={(event) => setData({ ...data, amount: event.target.value })} placeholder="0" /></label><label className="full">Mục đích<textarea required value={data.memo} onChange={(event) => setData({ ...data, memo: event.target.value })} placeholder="Giải thích khoản chi cho ba owner xem xét..."/><small className={totalBytes > 160 ? "over" : ""}>{totalBytes}/160 UTF-8 bytes (gồm tiêu đề)</small></label></div><div className="modal-rule"><Users /><span>Tạo proposal không đồng nghĩa với phê duyệt. Khoản chi sẽ bắt đầu ở 0/3; mỗi owner phải mở hồ sơ và bấm xác nhận bằng ví riêng.</span></div><button className="modal-submit" disabled={totalBytes > 160}>Tạo proposal 0/3 <ArrowRight /></button></form></ModalShell>;
}

function DepositModal({ close, submit }: { close: () => void; submit: (amount: string) => void }) {
  const [amount, setAmount] = useState("");
  return <ModalShell close={close}><form onSubmit={(event) => { event.preventDefault(); void submit(amount); }}><ModalHeader eyebrow="Native XLM · Stellar Asset Contract" title="Nạp tài sản vào treasury" close={close}/><label>Số lượng XLM<input required min="0.0000001" step="0.0000001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label><div className="modal-rule"><ShieldCheck /><span>Freighter sẽ hiển thị transaction Testnet trước khi bạn ký.</span></div><button className="modal-submit">Mở Freighter để xác nhận <ArrowRight /></button></form></ModalShell>;
}

function ConfirmModal({ kind, proposal, session, close, confirm }: { kind: "sign" | "execute"; proposal: Proposal; session: Session; close: () => void; confirm: () => void }) {
  const [checked, setChecked] = useState(false);
  return <ModalShell close={close}><div><ModalHeader eyebrow={kind === "sign" ? `Approval ${proposal.approvals.length + 1}/3 · ${session.owner}` : "Unanimous approval · 3/3"} title={kind === "sign" ? "Ký xác nhận khoản chi" : "Thực thi khoản chi"} close={close}/><div className="confirm-identity"><OwnerAvatar name={session.owner}/><span><small>VÍ SẼ KÝ TRANSACTION</small><b>{session.owner}</b><code>{shortAddress(session.address)}</code></span></div><div className="confirm-summary"><span>PROPOSAL #{String(proposal.id).padStart(2, "0")}</span><h3>{proposal.title}</h3><strong>{fmt(proposal.amount)} <small>XLM</small></strong><p>Người nhận: {shortAddress(proposal.recipient)}</p></div><label className="confirm-check" htmlFor="confirm-review"><input id="confirm-review" aria-label="Xác nhận đã kiểm tra đề xuất" type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span><b>Tôi đã kiểm tra người nhận, số tiền và mục đích.</b><small>{kind === "sign" ? "Chữ ký của địa chỉ này chỉ được ghi một lần." : "Transaction này sẽ chuyển tài sản khỏi treasury."}</small></span></label><div className="modal-rule"><Fingerprint /><span>Hãy kiểm tra lại chính địa chỉ đang mở trong cửa sổ Freighter trước khi chấp nhận.</span></div><button className="modal-submit" disabled={!checked} onClick={confirm}>{kind === "sign" ? `Mở Freighter và ký ${proposal.approvals.length + 1}/3` : "Ký và thực thi"}<ArrowRight /></button></div></ModalShell>;
}

function ModalShell({ children, close }: { children: React.ReactNode; close: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal-card" role="dialog" aria-modal="true">{children}</div></div>;
}

function ModalHeader({ eyebrow, title, close }: { eyebrow: string; title: string; close: () => void }) {
  return <div className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><button onClick={close} type="button" aria-label="Đóng"><X /></button></div>;
}
