# PDU Multisig Treasury

Kho quỹ XLM đa chữ ký cấp ứng dụng trên Stellar/Soroban. Mỗi khoản chi đi qua ba bước: **tạo đề xuất → đủ phê duyệt → thực thi**. Bản V1 mặc định dùng mô hình 2/3 owner (Alice, Bob, Carol), native XLM qua Stellar Asset Contract và Freighter để kết nối ví.

> Đây là multisig workflow trong smart contract, không phải native account multisig và không triển khai custom `__check_auth`.

## Chạy nhanh nhất trên Windows

1. Giải nén project.
2. Nhấp đúp **`CHAY_WEB.bat`**.
3. Chờ trình duyệt mở `http://localhost:3000`.

Lần đầu, file sẽ tự cài dependency nếu cần. Các lần sau web khởi động ngay. Dữ liệu demo đã có sẵn và được lưu trên chính trình duyệt, vì vậy có thể thử tạo proposal, approve, execute và nạp quỹ mà chưa cần Testnet.

Điều kiện duy nhất của máy chạy: **Node.js 22 trở lên**. Tải tại <https://nodejs.org/> nếu Windows báo chưa có Node.js.

## Tải từ GitHub và chạy bằng CMD/Terminal

Máy cần cài **Git** và **Node.js 22 trở lên**. Mở CMD hoặc Windows Terminal rồi chạy lần lượt:

```cmd
git clone https://github.com/haxuyenphan69-prog/PDU_Multisig_Treasury.git
cd PDU_Multisig_Treasury
npm install
npm run dev
```

Sau khi Terminal hiện địa chỉ `http://localhost:3000`, mở địa chỉ đó trên trình duyệt. Giữ cửa sổ Terminal đang chạy trong suốt thời gian sử dụng website; nhấn `Ctrl + C` để dừng.

Nếu đã tải project dạng ZIP, giải nén rồi mở CMD đúng tại thư mục chứa `package.json`, sau đó chạy:

```cmd
npm install
npm run dev
```

Không chạy `npm install` ngay tại `C:\Users\ten-ban` vì npm sẽ không tìm thấy `package.json`.

### Các lệnh thường dùng

```cmd
npm run dev
npm run build
npm test
```

- `npm run dev`: chạy website để phát triển và thử nghiệm.
- `npm run build`: kiểm tra bản build production.
- `npm test`: chạy kiểm thử render frontend.

## Kiểm tra toàn bộ bài

Nhấp đúp `KIEM_TRA_PROJECT.bat`, hoặc chạy:

```cmd
cargo test -p pdu-multisig-treasury
cargo build --target wasm32v1-none --release -p pdu-multisig-treasury
npm run build
```

WASM dựng sẵn nằm tại `pdu_multisig_treasury.wasm`. Source contract nằm tại `contracts/pdu_multisig_treasury/src/lib.rs`.

## Chức năng contract

| Hàm | Mục đích |
|---|---|
| `__constructor` | Khóa owners, threshold và token |
| `deposit` | Chuyển XLM SAC vào treasury |
| `create_proposal` | Tạo proposal, proposer tự approve |
| `approve` | Owner ký đúng một lần |
| `cancel_proposal` | Proposer huỷ trước khi đủ threshold |
| `execute` | Chuyển XLM khi đủ ngưỡng |
| getters | Đọc config, proposal, approvals, balance và trạng thái |

Contract dùng `require_auth()`, `#[contracterror]`, Persistent/Instance storage, event typed và checks-effects-interactions. Khi token transfer thất bại, Soroban rollback cả trạng thái `Executed`.

## Đơn vị và giới hạn

- `1 XLM = 10,000,000` stroops.
- Amount on-chain là `i128`; frontend xử lý bằng chuỗi/`BigInt`, không dùng số thực để ký transaction.
- Tối đa 10 owners.
- Memo tối đa **160 UTF-8 bytes**.
- Proposal lifetime tối đa 120.960 ledger.
- Business expiry độc lập với storage TTL.

## Deploy Testnet thật

Cài Rust, target `wasm32v1-none`, Stellar CLI và Freighter. Sau đó:

```cmd
stellar keys generate --global alice --network testnet --fund
stellar contract id asset --asset native --network testnet
stellar contract deploy --wasm pdu_multisig_treasury.wasm --source alice --network testnet --alias pdu_treasury -- --owners '["G_ALICE","G_BOB","G_CAROL"]' --threshold 2 --token C_NATIVE_XLM_SAC
```

Lưu Contract ID và SAC ID vào file `.env.local` dựa trên `.env.example`, rồi chạy lại frontend. Không commit secret key hoặc seed phrase. Freighter giữ khóa trên thiết bị người dùng.

## Cấu trúc

```text
contracts/pdu_multisig_treasury/   Rust contract + tests
packages/pdu-multisig-treasury-client/  Types, error map, XLM helpers
app/                               Frontend React/TypeScript
docs/SOROBAN_STUDIO.md             Hướng dẫn Studio
pdu_multisig_treasury.wasm         WASM đã build
CHAY_WEB.bat                       Chạy một chạm
```

## Kiểm thử đã xác nhận

- 11 Rust unit/integration tests trọng yếu: constructor, duplicate owner, SAC deposit, amount, memo byte length, proposal auto-approval, duplicate approval, cancel, threshold, expiry, one-time execute và rollback khi thiếu balance.
- Frontend production build thành công.
- Kiểm tra tương tác tạo proposal thành công.
- Responsive 375 px không bị tràn ngang.

Danh mục 322 test case trong kế hoạch là acceptance catalog gồm automated, frontend, Studio, deploy và manual evidence; không nên mô tả cả 322 là Rust unit test.

## Tài liệu tham khảo

- [Stellar Hello World](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world)
- [Stellar Asset Contract](https://developers.stellar.org/docs/build/guides/tokens/stellar-asset-contract)
- [Soroban authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization)
- [Soroban Studio](https://soroban.studio/)
- [stellar-notes-dapp](https://github.com/minhbear/stellar-notes-dapp) — chỉ tham khảo cấu trúc học tập

## Lưu ý

Project phục vụ học tập trên Testnet, chưa qua kiểm toán bảo mật và không dùng với tiền thật. Event RPC có thời gian lưu hữu hạn; lịch sử dài hạn cần indexer off-chain.
