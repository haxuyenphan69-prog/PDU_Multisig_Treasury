# PDU Multisig Treasury

Ứng dụng quản lý kho quỹ XLM đa chữ ký trên Stellar/Soroban. Mỗi khoản chi phải nhận đủ chữ ký của **3/3 owner độc lập** trước khi contract cho phép thực thi.

> Đây là multisig workflow ở tầng smart contract, không phải native Stellar account multisig và không triển khai custom `__check_auth`.

## Luồng ba tài khoản thật

Ứng dụng không có nút giả lập chuyển vai trò. Danh tính hiện tại luôn được lấy từ đúng địa chỉ ví Freighter đang kết nối:

1. Một owner kết nối Freighter và tạo proposal. Contract lưu proposal ở trạng thái **0/3**, chưa tính người tạo là đã xác nhận.
2. **Owner 01** kết nối ví, mở đúng khoản chi và bấm xác nhận để proposal thành 1/3.
3. Đổi sang **Owner 02**, kết nối lại, mở cùng khoản chi và xác nhận thành 2/3.
4. Đổi sang **Owner 03**, kết nối lại và xác nhận approval 3/3.
5. Khi proposal đạt 3/3, một owner kết nối có thể gửi transaction `execute` cuối cùng để chuyển XLM.

## Contract Testnet đang hoạt động

- Contract ID: `CAM5TLNZA3ETITVK7FWIVCE7XTLYDXLHCF75AVWEOODZCFQN5ZB4LMQB`
- Native XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Threshold: `3/3`
- Owner 01: `GCRKBBW7GN4KUYSCPMWE5N3RL3FJAQQYG4BHKH4L2QY5R7XX2LB22ZCK`
- Owner 02: `GAQ6FR2SYNHESJP4Q2QBDL527624IGCYTYIZBHVRU3GOIABKZZUNSXTU`
- Owner 03: `GBK36GGL2SBMP3AS54WSTXKTFH2XHSVSP2FUF2IG45ORETNOGU7UHVZN`

[Mở contract bằng Stellar Lab](https://lab.stellar.org/r/testnet/contract/CAM5TLNZA3ETITVK7FWIVCE7XTLYDXLHCF75AVWEOODZCFQN5ZB4LMQB)

Mỗi lần kết nối, frontend kiểm tra:

- Freighter đang dùng **Stellar Testnet**.
- Địa chỉ G... có nằm trong danh sách owner của contract hay không.
- Ví hiện tại đã ký proposal này chưa.
- Proposal đã đủ đúng 3/3 approval trước khi mở quyền thực thi hay chưa.

Nếu người dùng đổi tài khoản hoặc đổi mạng trong Freighter, DApp tự huỷ phiên hiện tại và bắt buộc kết nối lại. Frontend không lưu secret key hay seed phrase.

## Hai chế độ giao diện

- **READ-ONLY PREVIEW:** chưa có `NEXT_PUBLIC_TREASURY_CONTRACT_ID`. Website chỉ hiển thị dữ liệu minh hoạ; tạo, ký, nạp quỹ và thực thi đều bị khoá. Không có chữ ký giả hoặc dữ liệu giả được ghi vào trình duyệt.
- **TESTNET LIVE:** đã cấu hình Contract ID hợp lệ. Proposal, approval, balance và owner được đọc từ Soroban RPC; transaction được ký bằng Freighter.

## Chạy nhanh trên Windows

### Cách 1: file chạy có sẵn

1. Giải nén project.
2. Nhấp đúp `CHAY_WEB.bat`.
3. Mở địa chỉ Terminal hiển thị, thường là <http://localhost:3000>.

### Cách 2: CMD/Terminal

Máy cần cài [Git](https://git-scm.com/) và [Node.js 22 trở lên](https://nodejs.org/). Chạy từng lệnh:

```cmd
git clone https://github.com/haxuyenphan69-prog/PDU_Multisig_Treasury.git
cd PDU_Multisig_Treasury
npm install
npm run dev
```

Giữ Terminal đang chạy trong suốt thời gian dùng website. Nhấn `Ctrl + C` để dừng.

Nếu tải project dạng ZIP, hãy mở CMD đúng tại thư mục có `package.json`, sau đó chạy:

```cmd
npm install
npm run dev
```

Không chạy `npm install` ngay tại `C:\Users\ten-ban`, vì npm sẽ không tìm thấy `package.json`.

## Kiểm tra project

Nhấp đúp `KIEM_TRA_PROJECT.bat`, hoặc chạy:

```cmd
cargo test -p pdu-multisig-treasury
cargo build --target wasm32v1-none --release -p pdu-multisig-treasury
npm run lint
npm test
```

WASM đã build nằm tại `pdu_multisig_treasury.wasm`. Source contract nằm tại `contracts/pdu_multisig_treasury/src/lib.rs`.

## Deploy contract lên Testnet

Cài Rust, target `wasm32v1-none`, Stellar CLI và Freighter. Chuẩn bị ba tài khoản Testnet khác nhau:

```cmd
stellar keys generate --global owner01 --network testnet --fund
stellar keys generate --global owner02 --network testnet --fund
stellar keys generate --global owner03 --network testnet --fund

stellar keys address owner01
stellar keys address owner02
stellar keys address owner03
stellar contract id asset --asset native --network testnet
```

Deploy contract với đúng ba public address và threshold 3:

```cmd
stellar contract deploy --wasm pdu_multisig_treasury.wasm --source owner01 --network testnet --alias pdu_treasury -- --owners '["G_OWNER_01","G_OWNER_02","G_OWNER_03"]' --threshold 3 --token C_NATIVE_XLM_SAC
```

Tạo `.env.local` dựa trên `.env.example`:

```env
NEXT_PUBLIC_TREASURY_CONTRACT_ID=C...CONTRACT_ID_DA_DEPLOY
NEXT_PUBLIC_XLM_SAC_ID=C...NATIVE_XLM_SAC
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Khởi động lại frontend sau khi đổi biến môi trường:

```cmd
npm run dev
```

Không commit secret key, seed phrase hoặc file `.env.local`.

## Kiểm thử thủ công bằng ba tài khoản Freighter

1. Import hoặc tạo ba tài khoản Testnet riêng trong Freighter; public address phải trùng cấu hình contract.
2. Chọn Owner 01 trong Freighter, đặt mạng Testnet, kết nối DApp và tạo proposal.
3. Kiểm tra proposal mới hiển thị 0/3. Mở proposal và bấm xác nhận bằng Owner 01 để thành 1/3.
4. Chuyển Freighter sang Owner 02, kết nối lại, mở cùng proposal và xác nhận thành 2/3. Ở bước này vẫn chưa thể thực thi.
5. Chuyển Freighter sang Owner 03, kết nối lại, mở proposal và xác nhận. Kiểm tra trạng thái 3/3.
6. Gửi transaction thực thi. Kiểm tra balance giảm đúng amount và proposal chuyển sang `Executed`.
7. Thử ví không thuộc owner; DApp phải từ chối quyền ký.
8. Thử ký lặp bằng cùng owner; contract phải từ chối.

## Chức năng contract

| Hàm | Mục đích |
|---|---|
| `__constructor` | Lưu ba owner, threshold 3 và token |
| `deposit` | Chuyển XLM SAC vào treasury |
| `create_proposal` | Tạo proposal ở trạng thái 0/3, không tự approve |
| `approve` | Owner ký đúng một lần bằng `require_auth()` |
| `cancel_proposal` | Proposer huỷ trước khi đủ threshold |
| `execute` | Chuyển XLM khi đủ 3/3 approval |
| getters | Đọc config, proposal, approval, balance và trạng thái |

Contract dùng `require_auth()`, `#[contracterror]`, Instance/Persistent storage, typed event và checks-effects-interactions. Khi token transfer thất bại, Soroban rollback trạng thái `Executed`.

## Đơn vị và giới hạn

- `1 XLM = 10,000,000` stroops.
- Amount on-chain là `i128`; frontend dùng chuỗi và `BigInt` khi tạo transaction.
- Contract hỗ trợ tối đa 10 owner, nhưng giao diện này yêu cầu đúng 3 owner và threshold 3.
- Memo tối đa 160 UTF-8 bytes, bao gồm tiêu đề ghép vào memo.
- Proposal lifetime tối đa 120.960 ledger.
- Business expiry độc lập với storage TTL.

## Cấu trúc chính

```text
contracts/pdu_multisig_treasury/       Rust contract + tests
packages/pdu-multisig-treasury-client/ TypeScript helpers
app/                                   React frontend
app/stellar-treasury.ts                Soroban RPC + Freighter adapter
docs/SOROBAN_STUDIO.md                 Hướng dẫn Soroban Studio
pdu_multisig_treasury.wasm             WASM đã build
CHAY_WEB.bat                            Chạy website trên Windows
```

## Tài liệu tham khảo

- [Stellar Smart Contracts: Hello World](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world)
- [Stellar Asset Contract](https://developers.stellar.org/docs/build/guides/tokens/stellar-asset-contract)
- [Soroban authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization)
- [Soroban Studio](https://soroban.studio/)
- [stellar-notes-dapp](https://github.com/minhbear/stellar-notes-dapp) — tham khảo cấu trúc học tập

## Lưu ý

Project dùng cho học tập trên Testnet, chưa qua kiểm toán bảo mật và không dùng với tiền thật. Event RPC có thời gian lưu hữu hạn; lịch sử dài hạn cần indexer off-chain.
