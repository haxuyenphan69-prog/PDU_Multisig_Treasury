"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, Copy, ExternalLink, FilePlus2, Fingerprint, KeyRound,
  Landmark, LockKeyhole, Menu, Plus, RefreshCw, RotateCcw, ShieldCheck,
  Sparkles, Users, Wallet, X,
} from "lucide-react";
import { chainActions, isChainConfigured, loadChainSnapshot } from "./stellar-treasury";

type OwnerName = "Alice" | "Bob" | "Carol";
type Status = "pending" | "ready" | "executed" | "cancelled" | "expired";
type Proposal = {
  id: number; title: string; memo: string; recipient: string; amount: number;
  approvals: OwnerName[]; status: Status; created: string; expires: string;
  proposer: OwnerName; executedAt?: string;
};
type ActivityItem = { id: string; actor: OwnerName; action: string; detail: string; time: string };

const OWNERS: Record<OwnerName, { address: string; role: string; tone: string }> = {
  Alice: { address: "GAKQ4...2FME", role: "Trưởng quỹ", tone: "coral" },
  Bob: { address: "GC7BW...P3AA", role: "Kiểm soát", tone: "blue" },
  Carol: { address: "GB3PH...09KD", role: "Vận hành", tone: "gold" },
};
const OWNER_NAMES = Object.keys(OWNERS) as OwnerName[];
const DEMO_OWNER_ADDRESSES: Record<OwnerName, string> = {
  Alice: OWNERS.Alice.address,
  Bob: OWNERS.Bob.address,
  Carol: OWNERS.Carol.address,
};
const STORAGE_KEY = "pdu-treasury-v2-unanimous";
const INITIAL_PROPOSALS: Proposal[] = [
  { id: 4, title: "Tài trợ Demo Day mùa thu", memo: "Ngân sách sân khấu, âm thanh và truyền thông cho Demo Day PDU.", recipient: "GDAV4...KQ9M", amount: 280, approvals: ["Alice", "Bob"], status: "pending", created: "13 Thg 8", expires: "Còn 5 ngày", proposer: "Alice" },
  { id: 3, title: "Gia hạn máy chủ cộng đồng", memo: "Chi phí hạ tầng ba tháng cho cổng sinh viên.", recipient: "GBH8K...7R2P", amount: 85.5, approvals: ["Carol"], status: "pending", created: "12 Thg 8", expires: "Còn 3 ngày", proposer: "Carol" },
  { id: 2, title: "Học bổng Stellar Bootcamp", memo: "Hỗ trợ 5 sinh viên hoàn thành chương trình Soroban.", recipient: "GCGQ9...L5TX", amount: 500, approvals: ["Alice", "Bob", "Carol"], status: "executed", created: "04 Thg 8", expires: "Đã thực thi", proposer: "Alice", executedAt: "04 Thg 8 · 16:42" },
  { id: 1, title: "Workshop Rust cơ bản", memo: "Chi phí diễn giả và tài liệu workshop.", recipient: "GDM2F...K11C", amount: 120, approvals: ["Bob"], status: "cancelled", created: "28 Thg 7", expires: "Đã huỷ", proposer: "Bob" },
];
const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: "a1", actor: "Carol", action: "đã ký", detail: "Đề xuất #03", time: "11:08" },
  { id: "a2", actor: "Bob", action: "đã ký", detail: "Đề xuất #04", time: "10:46" },
  { id: "a3", actor: "Alice", action: "đã tạo", detail: "Đề xuất #04", time: "09:30" },
];
const LABEL: Record<Status, string> = { pending: "Đang ký", ready: "Đủ 3 chữ ký", executed: "Đã giải ngân", cancelled: "Đã huỷ", expired: "Hết hạn" };
const fmt = (n: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
const shortNow = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

export default function TreasuryApp() {
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [selectedId, setSelectedId] = useState(4);
  const [viewer, setViewer] = useState<OwnerName>("Carol");
  const [filter, setFilter] = useState<"all" | "mine" | "closed">("all");
  const [modal, setModal] = useState<"create" | "deposit" | "sign" | "execute" | null>(null);
  const [wallet, setWallet] = useState("");
  const [ownerAddresses, setOwnerAddresses] = useState(DEMO_OWNER_ADDRESSES);
  const [latestLedger, setLatestLedger] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [balance, setBalance] = useState(1842.75);
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  useEffect(() => {
    if (isChainConfigured) return;
    let data: { proposals?: Proposal[]; balance?: number; activity?: ActivityItem[] } | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) data = JSON.parse(saved);
    } catch { /* Dữ liệu demo lỗi sẽ tự về mặc định. */ }
    const timer = window.setTimeout(() => {
      if (data) {
        setProposals(data.proposals ?? INITIAL_PROPOSALS);
        setBalance(data.balance ?? 1842.75);
        setActivity(data.activity ?? INITIAL_ACTIVITY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (isChainConfigured) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ proposals, balance, activity }));
  }, [proposals, balance, activity]);

  const syncChain = useCallback(async () => {
    if (!isChainConfigured) return;
    setSyncing(true);
    try {
      const snapshot = await loadChainSnapshot();
      if (snapshot.owners.length !== 3) throw new Error("Bản giao diện này yêu cầu đúng 3 owner");
      const addresses = Object.fromEntries(OWNER_NAMES.map((name, index) => [name, snapshot.owners[index]])) as Record<OwnerName, string>;
      const nameFor = (address: string) => OWNER_NAMES.find((name) => addresses[name] === address) ?? "Alice";
      const next = snapshot.proposals.map((proposal) => {
        const [title, ...memoParts] = proposal.memo.split(": ");
        return {
        id: Number(proposal.id),
        title: title || `Đề xuất #${proposal.id}`,
        memo: memoParts.join(": ") || proposal.memo,
        recipient: proposal.recipient,
        amount: Number(proposal.amount) / 10_000_000,
        approvals: proposal.approvals.map(nameFor),
        status: proposal.status === "Executed" ? "executed" : proposal.status === "Cancelled" ? "cancelled" : snapshot.latestLedger >= proposal.expiresAtLedger ? "expired" : proposal.approvalCount === 3 ? "ready" : "pending",
        created: `Ledger ${proposal.createdAtLedger.toLocaleString("vi-VN")}`,
        expires: snapshot.latestLedger >= proposal.expiresAtLedger ? "Đã hết hạn" : `Còn ${proposal.expiresAtLedger - snapshot.latestLedger} ledger`,
        proposer: nameFor(proposal.proposer),
      } satisfies Proposal;});// Mỗi record được giải mã từ contract storage.
      setOwnerAddresses(addresses);
      setProposals(next);
      setBalance(Number(snapshot.balance) / 10_000_000);
      setLatestLedger(snapshot.latestLedger);
      setActivity(next.flatMap((proposal) => proposal.approvals.map((actor) => ({
        id: `chain-${proposal.id}-${actor}`,
        actor,
        action: "đã ký on-chain",
        detail: `Đề xuất #${String(proposal.id).padStart(2, "0")}`,
        time: proposal.created,
      }))).slice(0, 8));
      if (next.length) setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0].id);
      if (wallet) {
        const connectedName = OWNER_NAMES.find((name) => addresses[name] === wallet);
        if (connectedName) setViewer(connectedName);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không đồng bộ được Soroban RPC");
    } finally {
      setSyncing(false);
    }
  }, [notify, wallet]);

  useEffect(() => {
    if (!isChainConfigured) return;
    const timer = window.setTimeout(() => void syncChain(), 0);
    return () => window.clearTimeout(timer);
  }, [syncChain]);

  const active = proposals.find((proposal) => proposal.id === selectedId) ?? proposals[0] ?? INITIAL_PROPOSALS[0];
  const waitingForViewer = proposals.filter((proposal) => proposal.status === "pending" && !proposal.approvals.includes(viewer));
  const visible = useMemo(() => proposals.filter((proposal) => {
    if (filter === "mine") return proposal.status === "pending" && !proposal.approvals.includes(viewer);
    if (filter === "closed") return ["executed", "cancelled", "expired"].includes(proposal.status);
    return true;
  }), [filter, proposals, viewer]);

  const appendActivity = (actor: OwnerName, action: string, proposal: Proposal) => {
    setActivity((items) => [{ id: `${Date.now()}`, actor, action, detail: `Đề xuất #${String(proposal.id).padStart(2, "0")}`, time: shortNow() }, ...items].slice(0, 8));
  };
  async function connectWallet() {
    try {
      const { requestAccess } = await import("@stellar/freighter-api");
      const result = await requestAccess();
      if (result.error) throw new Error(result.error.message || "Freighter từ chối kết nối");
      if (isChainConfigured) {
        let addresses = ownerAddresses;
        if (OWNER_NAMES.some((name) => addresses[name].includes("..."))) {
          const snapshot = await loadChainSnapshot();
          addresses = Object.fromEntries(OWNER_NAMES.map((name, index) => [name, snapshot.owners[index]])) as Record<OwnerName, string>;
          setOwnerAddresses(addresses);
        }
        const connectedName = OWNER_NAMES.find((name) => addresses[name] === result.address);
        if (!connectedName) throw new Error("Ví này không nằm trong danh sách 3 owner của contract");
        setViewer(connectedName);
      }
      setWallet(result.address);
      notify(isChainConfigured ? "Đã kết nối owner và đồng bộ Testnet" : "Đã kết nối Freighter trên Testnet");
    } catch (error) {
      if (isChainConfigured) {
        notify(error instanceof Error ? error.message : "Không kết nối được Freighter");
      } else {
        setWallet(ownerAddresses[viewer]);
        notify(`Đang dùng ví demo của ${viewer}`);
      }
    }
  }
  async function confirmSign() {
    if (!active || active.status !== "pending" || active.approvals.includes(viewer)) return;
    if (isChainConfigured) {
      if (!wallet || wallet !== ownerAddresses[viewer]) { notify(`Hãy kết nối đúng ví của ${viewer}`); return; }
      setSyncing(true);
      try {
        await chainActions.approve(wallet, BigInt(active.id));
        setModal(null); notify(`${viewer} đã ký trên Testnet`); await syncChain();
      } catch (error) { notify(error instanceof Error ? error.message : "Ký thất bại"); }
      finally { setSyncing(false); }
      return;
    }
    const approvals = [...active.approvals, viewer];
    const updated: Proposal = { ...active, approvals, status: approvals.length === 3 ? "ready" : "pending" };
    setProposals((items) => items.map((item) => item.id === active.id ? updated : item));
    appendActivity(viewer, "đã ký", updated);
    setModal(null);
    notify(approvals.length === 3 ? "Đã đủ 3/3 chữ ký — khoản chi sẵn sàng thực thi" : `${viewer} đã ký — còn ${3 - approvals.length} chữ ký`);
  }
  async function confirmExecute() {
    if (!active || active.status !== "ready" || active.approvals.length !== 3) return;
    if (isChainConfigured) {
      if (!wallet || wallet !== ownerAddresses[viewer]) { notify(`Hãy kết nối đúng ví của ${viewer}`); return; }
      setSyncing(true);
      try {
        await chainActions.execute(wallet, BigInt(active.id));
        setModal(null); notify("Khoản chi đã được thực thi trên Testnet"); await syncChain();
      } catch (error) { notify(error instanceof Error ? error.message : "Thực thi thất bại"); }
      finally { setSyncing(false); }
      return;
    }
    const updated: Proposal = { ...active, status: "executed", expires: "Vừa thực thi", executedAt: `Hôm nay · ${shortNow()}` };
    setProposals((items) => items.map((item) => item.id === active.id ? updated : item));
    setBalance((value) => value - active.amount);
    appendActivity(viewer, "đã thực thi", updated);
    setModal(null);
    notify("Khoản chi đã được mô phỏng xác nhận trên ledger");
  }
  function resetDemo() {
    if (isChainConfigured) { void syncChain(); return; }
    setProposals(INITIAL_PROPOSALS); setBalance(1842.75); setActivity(INITIAL_ACTIVITY);
    setSelectedId(4); localStorage.removeItem(STORAGE_KEY); notify("Đã khôi phục dữ liệu demo");
  }
  async function submitProposal(data: Record<string, string>) {
    if (isChainConfigured) {
      if (!wallet || wallet !== ownerAddresses[viewer]) { notify(`Hãy kết nối đúng ví của ${viewer}`); return; }
      const memo = `${data.title}: ${data.memo}`;
      if (new TextEncoder().encode(memo).length > 160) { notify("Tiêu đề và mục đích vượt 160 UTF-8 bytes"); return; }
      setSyncing(true);
      try {
        await chainActions.createProposal(wallet, data.recipient, data.amount, memo, latestLedger + 120_000);
        setModal(null); notify("Đề xuất đã được tạo trên Testnet"); await syncChain();
      } catch (error) { notify(error instanceof Error ? error.message : "Tạo đề xuất thất bại"); }
      finally { setSyncing(false); }
      return;
    }
    const proposal: Proposal = { id: Math.max(...proposals.map((p) => p.id)) + 1, title: data.title, memo: data.memo, recipient: data.recipient, amount: Number(data.amount), approvals: [viewer], status: "pending", created: "Hôm nay", expires: "Còn 7 ngày", proposer: viewer };
    setProposals((items) => [proposal, ...items]); setSelectedId(proposal.id); appendActivity(viewer, "đã tạo", proposal); setModal(null); notify("Đã gửi đề xuất tới phòng ký của cả 3 thành viên");
  }
  async function submitDeposit(amount: string) {
    if (isChainConfigured) {
      if (!wallet || wallet !== ownerAddresses[viewer]) { notify(`Hãy kết nối đúng ví của ${viewer}`); return; }
      setSyncing(true);
      try { await chainActions.deposit(wallet, amount); setModal(null); notify("Đã nạp XLM vào contract"); await syncChain(); }
      catch (error) { notify(error instanceof Error ? error.message : "Nạp quỹ thất bại"); }
      finally { setSyncing(false); }
      return;
    }
    setBalance((value) => value + Number(amount)); setModal(null); notify("Đã nạp quỹ ở chế độ demo");
  }
  async function copyRecipient() {
    try {
      await navigator.clipboard.writeText(active.recipient);
      notify("Đã sao chép địa chỉ người nhận");
    } catch {
      notify("Không thể sao chép tự động trên trình duyệt này");
    }
  }

  return <div className="treasury-app">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-seal"><Landmark /></span><span><b>PDU</b><em>Treasury</em></span></a>
      <nav className={navOpen ? "nav open" : "nav"}><a href="#overview">Tổng quan</a><a href="#proposals">Phòng ký</a><a href="#members">Thành viên</a><a href="#activity">Nhật ký</a></nav>
      <div className="top-actions"><span className="network-pill"><i /> {isChainConfigured ? "TESTNET LIVE" : "TESTNET DEMO"}</span><button className="wallet-button" onClick={connectWallet}><Wallet />{wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Kết nối Freighter"}</button><button className="menu-button" onClick={() => setNavOpen(!navOpen)} aria-label="Mở menu"><Menu /></button></div>
    </header>

    <main id="top">
      <section className="hero" id="overview">
        <div className="hero-copy"><span className="eyebrow"><Sparkles /> Kho quỹ đồng thuận 3/3</span><h1>Một khoản chi.<br/><em>Ba người cùng quyết.</em></h1><p>Mọi đề xuất xuất hiện trong phòng ký của Alice, Bob và Carol. Chỉ khi cả ba xác nhận, contract mới cho phép giải ngân.</p><div className="hero-actions"><button onClick={() => setModal("create")}><FilePlus2 /> Tạo đề xuất</button><button className="ghost" onClick={() => document.querySelector("#proposals")?.scrollIntoView()}><Fingerprint /> Mở phòng ký</button></div></div>
        <div className="consensus-card"><div className="consensus-head"><span>QUY TẮC THỰC THI</span><ShieldCheck /></div><strong>3<span>/3</span></strong><h2>Không đủ chữ ký,<br/>không thể chuyển tiền.</h2><div className="signature-route">{OWNER_NAMES.map((name, index) => <div key={name}><OwnerAvatar name={name}/><span>{name}<small>{OWNERS[name].role}</small></span>{index < 2 && <ArrowRight />}</div>)}</div><small className="contract-rule"><LockKeyhole /> `require_auth()` xác minh từng signer</small></div>
      </section>

      <section className="overview-grid">
        <article className="treasury-balance"><div className="card-label"><span>TÀI SẢN TRONG KHO</span><button aria-label="Làm mới" onClick={() => isChainConfigured ? void syncChain() : notify("Dữ liệu demo đã được làm mới")}><RefreshCw className={syncing ? "spin" : ""} /></button></div><div className="balance-value"><strong>{fmt(balance)}</strong><span>XLM</span></div><div className="balance-meta"><span>≈ {(balance * 6_450).toLocaleString("vi-VN")} ₫</span><span><i /> Native XLM SAC</span></div><div className="balance-buttons"><button onClick={() => setModal("deposit")}><ArrowDownToLine /> Nạp quỹ</button><button className="secondary" onClick={resetDemo}><RotateCcw className={syncing ? "spin" : ""} /> {isChainConfigured ? "Đồng bộ RPC" : "Khôi phục demo"}</button></div></article>
        <div className="stat-grid"><article><span>Đang chờ chữ ký</span><strong>{proposals.filter((p) => p.status === "pending").length}</strong><small><Clock3 /> Trong phòng ký chung</small></article><article className="accent"><span>Việc của {viewer}</span><strong>{waitingForViewer.length}</strong><small><KeyRound /> Cần bạn xác nhận</small></article><article><span>Đã đủ đồng thuận</span><strong>{proposals.filter((p) => p.status === "ready").length}</strong><small><CheckCircle2 /> Có thể thực thi</small></article><article><span>Đã giải ngân</span><strong>{fmt(proposals.filter((p) => p.status === "executed").reduce((sum, p) => sum + p.amount, 0))}<b> XLM</b></strong><small><Activity /> Được ghi nhận</small></article></div>
      </section>

      <section className="identity-switcher" id="members"><div><span className="section-label">{isChainConfigured ? "OWNER TỪ CONTRACT" : "PHIÊN LÀM VIỆC DEMO"}</span><h2>{isChainConfigured ? "Freighter quyết định bạn là ai." : "Bạn đang duyệt với tư cách ai?"}</h2><p>{isChainConfigured ? "Ba máy đọc chung proposal từ Soroban RPC; địa chỉ ví đang kết nối được đối chiếu với owner của contract." : "Đổi thành viên để kiểm tra đề xuất xuất hiện ở cả ba tài khoản."}</p></div><div className="owner-tabs">{OWNER_NAMES.map((name) => <button key={name} disabled={isChainConfigured} className={viewer === name ? "active" : ""} onClick={() => { setViewer(name); setWallet(""); }}><OwnerAvatar name={name}/><span>{name}<small>{ownerAddresses[name]}</small></span>{viewer === name && <CheckCircle2 />}</button>)}</div></section>

      <section className="signing-room" id="proposals">
        <div className="proposal-panel"><div className="section-head"><div><span className="section-label">PHÒNG KÝ CHUNG</span><h2>Đề xuất ngân quỹ</h2></div><button className="new-proposal" onClick={() => setModal("create")}><Plus /> Tạo mới</button></div><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả <b>{proposals.length}</b></button><button className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>Chờ {viewer} ký <b>{waitingForViewer.length}</b></button><button className={filter === "closed" ? "active" : ""} onClick={() => setFilter("closed")}>Đã đóng</button></div>
          <div className="proposal-list">{visible.map((proposal) => <button key={proposal.id} className={selectedId === proposal.id ? "proposal-row selected" : "proposal-row"} onClick={() => setSelectedId(proposal.id)}><span className={`status-dot ${proposal.status}`} /><span className="proposal-title"><b>#{String(proposal.id).padStart(2, "0")} · {proposal.title}</b><small>{proposal.recipient} · {proposal.created}</small></span><span className="mini-signatures">{OWNER_NAMES.map((name) => <i key={name} className={proposal.approvals.includes(name) ? "signed" : ""}>{proposal.approvals.includes(name) ? <Check /> : name[0]}</i>)}</span><span className="approval-count"><b>{proposal.approvals.length}/3</b><small>chữ ký</small></span><span className="proposal-value"><b>{fmt(proposal.amount)}</b><small>XLM</small></span><span className={`status-badge ${proposal.status}`}>{LABEL[proposal.status]}</span><ChevronRight /></button>)}</div>
        </div>

        <aside className="approval-panel">
          <div className="detail-kicker"><span>ĐỀ XUẤT #{String(active.id).padStart(2, "0")}</span><span className={`status-badge ${active.status}`}>{LABEL[active.status]}</span></div><h2>{active.title}</h2><p className="detail-memo">{active.memo}</p><div className="amount-callout"><span>Số tiền đề nghị</span><strong>{fmt(active.amount)} <small>XLM</small></strong></div><dl><div><dt>Người nhận</dt><dd>{active.recipient}<button className="copy-address" type="button" aria-label="Sao chép địa chỉ người nhận" onClick={copyRecipient}><Copy /></button></dd></div><div><dt>Người tạo</dt><dd>{active.proposer}</dd></div><div><dt>Thời hạn</dt><dd>{active.expires}</dd></div></dl>
          <div className="approval-progress"><div><span>Tiến độ đồng thuận</span><b>{active.approvals.length}/3 chữ ký</b></div><div className="progress-track"><i style={{ width: `${active.approvals.length / 3 * 100}%` }} /></div></div>
          <div className="signer-list">{OWNER_NAMES.map((name) => { const signed = active.approvals.includes(name); const current = viewer === name; return <div key={name} className={current ? "current" : ""}><OwnerAvatar name={name} signed={signed}/><span><b>{name}{current && <em>Bạn</em>}</b><small>{ownerAddresses[name]}</small></span><strong className={signed ? "signed-text" : "waiting-text"}>{signed ? "Đã ký" : "Chưa ký"}</strong></div>; })}</div>
          <ApprovalAction proposal={active} viewer={viewer} openSign={() => setModal("sign")} openExecute={() => setModal("execute")} />
        </aside>
      </section>

      <section className="audit-section" id="activity"><div className="audit-copy"><span className="section-label">NHẬT KÝ MINH BẠCH</span><h2>Mỗi chữ ký để lại một dấu vết.</h2><p>{isChainConfigured ? `Dữ liệu được đọc từ contract tại ledger ${latestLedger.toLocaleString("vi-VN")}. Mỗi máy đều thấy cùng proposal và approval.` : "Giao diện demo đồng bộ cùng một trạng thái cho cả ba owner trên trình duyệt hiện tại. Điền Contract ID để chuyển sang Soroban RPC thật."}</p><div className="security-note"><ShieldCheck /><span>Frontend không lưu secret key. Freighter tạo và ký transaction trên thiết bị của từng thành viên.</span></div></div><div className="activity-feed">{activity.map((item) => <article key={item.id}><OwnerAvatar name={item.actor}/><span><b>{item.actor} {item.action}</b><small>{item.detail}</small></span><time>{item.time}</time></article>)}</div></section>
    </main>

    <footer><span>PDU Multisig Treasury</span><span>Soroban SDK 27 · 3/3 unanimous approval · Testnet</span><a href="https://developers.stellar.org/" target="_blank" rel="noreferrer">Stellar Docs <ExternalLink /></a></footer>

    {modal === "create" && <ProposalModal viewer={viewer} close={() => setModal(null)} submit={submitProposal} />}
    {modal === "deposit" && <DepositModal close={() => setModal(null)} submit={submitDeposit} />}
    {modal === "sign" && <ConfirmModal kind="sign" proposal={active} viewer={viewer} close={() => setModal(null)} confirm={confirmSign} />}
    {modal === "execute" && <ConfirmModal kind="execute" proposal={active} viewer={viewer} close={() => setModal(null)} confirm={confirmExecute} />}
    {toast && <div className="toast"><CheckCircle2 />{toast}</div>}
  </div>;
}

function OwnerAvatar({ name, signed = false }: { name: OwnerName; signed?: boolean }) {
  return <i className={`owner-avatar ${OWNERS[name].tone} ${signed ? "signed" : ""}`}>{signed ? <Check /> : name[0]}</i>;
}

function ApprovalAction({ proposal, viewer, openSign, openExecute }: { proposal: Proposal; viewer: OwnerName; openSign: () => void; openExecute: () => void }) {
  const viewerSigned = proposal.approvals.includes(viewer);
  if (proposal.status === "executed") return <div className="action-state success"><CheckCircle2 /><span><b>Khoản chi đã hoàn tất</b><small>{proposal.executedAt ?? "Đã xác nhận trên ledger"}</small></span></div>;
  if (["cancelled", "expired"].includes(proposal.status)) return <div className="action-state muted"><CircleAlert /><span><b>Đề xuất đã đóng</b><small>Không thể thêm chữ ký hoặc thực thi.</small></span></div>;
  if (proposal.status === "ready") return <button className="approval-action execute" onClick={openExecute}><Fingerprint /><span><b>Thực thi khoản chi</b><small>Đủ 3/3 — ký transaction chuyển tiền</small></span><ArrowRight /></button>;
  if (viewerSigned) return <div className="action-state signed"><CheckCircle2 /><span><b>{viewer} đã hoàn tất phần của mình</b><small>Đang chờ {3 - proposal.approvals.length} thành viên còn lại.</small></span></div>;
  return <button className="approval-action" onClick={openSign}><KeyRound /><span><b>Ký với tư cách {viewer}</b><small>Xem lại rồi xác nhận chữ ký {proposal.approvals.length + 1}/3</small></span><ArrowRight /></button>;
}

function ProposalModal({ viewer, close, submit }: { viewer: OwnerName; close: () => void; submit: (data: Record<string, string>) => void }) {
  const [data, setData] = useState({ title: "", memo: "", recipient: "", amount: "" });
  const memoBytes = new TextEncoder().encode(data.memo).length;
  return <ModalShell close={close}><form onSubmit={(event) => { event.preventDefault(); if (memoBytes <= 160) submit(data); }}><ModalHeader eyebrow={`Tạo bởi ${viewer}`} title="Tạo đề xuất ngân quỹ" close={close}/><div className="form-grid"><label className="full">Tên khoản chi<input required value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="Ví dụ: Tài trợ cuộc thi sinh viên" /></label><label>Người nhận<input required value={data.recipient} onChange={(e) => setData({ ...data, recipient: e.target.value })} placeholder="Địa chỉ G..." /></label><label>Số lượng XLM<input required min="0.0000001" step="0.0000001" type="number" value={data.amount} onChange={(e) => setData({ ...data, amount: e.target.value })} placeholder="0" /></label><label className="full">Mục đích<textarea required value={data.memo} onChange={(e) => setData({ ...data, memo: e.target.value })} placeholder="Giải thích khoản chi cho hai thành viên còn lại..." /><small className={memoBytes > 160 ? "over" : ""}>{memoBytes}/160 UTF-8 bytes</small></label></div><div className="modal-rule"><Users /><span>Đề xuất sẽ xuất hiện cho Alice, Bob và Carol. {viewer} tự ký chữ ký đầu tiên khi tạo.</span></div><button className="modal-submit" disabled={memoBytes > 160}>Đưa vào phòng ký <ArrowRight /></button></form></ModalShell>;
}

function DepositModal({ close, submit }: { close: () => void; submit: (amount: string) => void }) {
  const [amount, setAmount] = useState("");
  return <ModalShell close={close}><form onSubmit={(event) => { event.preventDefault(); submit(amount); }}><ModalHeader eyebrow="Native XLM · SAC" title="Nạp tài sản vào kho" close={close}/><label>Số lượng XLM<input required min="0.0000001" step="0.0000001" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label><div className="modal-rule"><ShieldCheck /><span>Ở Testnet thật, Freighter sẽ yêu cầu ký transaction nạp tiền.</span></div><button className="modal-submit">Xác nhận nạp quỹ <ArrowRight /></button></form></ModalShell>;
}

function ConfirmModal({ kind, proposal, viewer, close, confirm }: { kind: "sign" | "execute"; proposal: Proposal; viewer: OwnerName; close: () => void; confirm: () => void }) {
  const [checked, setChecked] = useState(false);
  return <ModalShell close={close}><div><ModalHeader eyebrow={kind === "sign" ? `Chữ ký ${proposal.approvals.length + 1}/3` : "Đủ đồng thuận 3/3"} title={kind === "sign" ? `Xác nhận với tư cách ${viewer}` : "Thực thi khoản chi"} close={close}/><div className="confirm-summary"><span>Đề xuất #{String(proposal.id).padStart(2, "0")}</span><h3>{proposal.title}</h3><strong>{fmt(proposal.amount)} <small>XLM</small></strong><p>Người nhận: {proposal.recipient}</p></div><label className="confirm-check" htmlFor="confirm-review"><input id="confirm-review" aria-label="Xác nhận đã kiểm tra đề xuất" type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /><span><b>Tôi đã kiểm tra người nhận, số tiền và mục đích.</b><small>{kind === "sign" ? "Chữ ký của tôi sẽ không thể lặp lại." : "Thao tác này sẽ chuyển tài sản khỏi kho quỹ."}</small></span></label><div className="modal-rule"><Fingerprint /><span>Freighter sẽ hiển thị nội dung transaction trước khi ký khi kết nối Testnet thật.</span></div><button className="modal-submit" disabled={!checked} onClick={confirm}>{kind === "sign" ? `Ký xác nhận ${proposal.approvals.length + 1}/3` : "Ký và thực thi"}<ArrowRight /></button></div></ModalShell>;
}

function ModalShell({ children, close }: { children: React.ReactNode; close: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal-card" role="dialog" aria-modal="true">{children}</div></div>;
}
function ModalHeader({ eyebrow, title, close }: { eyebrow: string; title: string; close: () => void }) {
  return <div className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><button onClick={close} type="button" aria-label="Đóng"><X /></button></div>;
}
