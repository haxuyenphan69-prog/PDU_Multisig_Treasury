# PDU Multisig Treasury

> Demo kho quỹ XLM cần **3/3 chữ ký thật** trên Stellar Testnet, xây dựng bằng Rust, Soroban và Freighter.

Đây là mini project học tập. Ba chủ quỹ tạo một khoản chi, từng người đăng nhập bằng ví Freighter riêng để ký, và smart contract chỉ chuyển XLM khi đủ ba chữ ký.

**Không cần secret key trong project.** Mỗi transaction được Freighter mở cửa sổ để chính chủ ví kiểm tra và ký.

## Mục lục

1. [Chức năng và luồng 3 chữ ký](#chức-năng-và-luồng-3-chữ-ký)
2. [Chạy web trong 3 phút](#chạy-web-trong-3-phút)
3. [Chuẩn bị ba ví Testnet](#chuẩn-bị-ba-ví-testnet)
4. [Demo hoàn chỉnh](#demo-hoàn-chỉnh)
5. [Contract Testnet](#contract-testnet)
6. [Lỗi thường gặp](#lỗi-thường-gặp)
7. [Kiểm tra source code](#kiểm-tra-source-code)
8. [An toàn và tài liệu](#an-toàn-và-tài-liệu)

---

## Chức năng và luồng 3 chữ ký

| Chức năng | Ý nghĩa |
|---|---|
| Kết nối Freighter | Kiểm tra ví hiện tại có thuộc ba owner contract hay không. |
| Nạp quỹ | Chuyển XLM **từ ví Freighter vào treasury contract**. |
| Tạo proposal | Tạo khoản chi mới ở trạng thái `0/3`; người tạo chưa được tính là đã ký. |
| Ký proposal | Mỗi owner ký transaction `approve` riêng. Một địa chỉ chỉ ký được một lần. |
| Thực thi | Khi đủ `3/3`, một owner ký `execute` để chuyển XLM từ contract cho người nhận. |
| Đồng bộ | Đọc proposal, chữ ký và số dư trực tiếp từ Soroban RPC trên Testnet. |

Đây là multisig ở tầng **smart contract Soroban**, không phải native Stellar account multisig.

```text
Owner 01 tạo proposal ──> 0/3
       │
       ├─ Owner 01 mở proposal và ký ──> 1/3
       ├─ Owner 02 đổi ví Freighter, mở cùng proposal, ký ──> 2/3
       └─ Owner 03 đổi ví Freighter, mở cùng proposal, ký ──> 3/3
                                                            │
                                           Một owner thực thi ──> XLM được chuyển
```

Website không có nút giả lập đổi vai trò hoặc tự tăng chữ ký: từng bước là một transaction Testnet thật.

---

## Chạy web trong 3 phút

### Cách 1 — Nhanh nhất trên Windows

1. Tải project về máy hoặc giải nén file ZIP.
2. Mở đúng thư mục có hai file `package.json` và `CHAY_WEB.bat`.
3. Nhấp đúp **`CHAY_WEB.bat`**.
4. Đợi Terminal hiện địa chỉ và mở:

   <http://localhost:3000>

5. Giữ Terminal mở khi dùng web. Muốn dừng web, quay lại Terminal và nhấn `Ctrl + C`.

File `CHAY_WEB.bat` chỉ dùng cổng `3000`. Nếu cổng này đang bận, file sẽ dừng và báo rõ; nó không tự chuyển sang cổng 3001 để tránh mở nhầm giao diện cũ.

### Cách 2 — Dùng CMD/Terminal

#### Lần đầu tải từ GitHub

Trước hết cài [Node.js LTS](https://nodejs.org/) phiên bản 22 hoặc mới hơn và [Git](https://git-scm.com/). Mở CMD rồi chạy từng lệnh:

```cmd
git clone https://github.com/haxuyenphan69-prog/PDU_Multisig_Treasury.git
cd PDU_Multisig_Treasury
npm install
npm run dev -- --port 3000 --strictPort
```

Khi Terminal hiện `Local: http://localhost:3000/`, mở <http://localhost:3000>.

#### Nếu tải file ZIP

Mở CMD và đi vào **đúng thư mục đã giải nén**. Ví dụ trên máy tác giả:

```cmd
cd /d "C:\Users\chuqu\OneDrive\Documents\hoccode\PDU-Multisig-Treasury"
npm install
npm run dev -- --port 3000 --strictPort
```

Không chạy `npm install` tại `C:\Users\ten-ban`, vì npm sẽ báo không tìm thấy `package.json`.

### Dấu hiệu mở đúng web

Giao diện hiện tại có nền xanh đậm, logo **PDU Treasury** và nhãn **TESTNET LIVE**. Nếu thấy trang nền be có tiêu đề “Tiền chung. Quyết định chung.”, bạn đang mở một bản cũ ở thư mục hoặc cổng khác.

---

## Chuẩn bị ba ví Testnet

### 1. Cài và cấu hình Freighter

1. Cài extension [Freighter Wallet](https://freighter.app/).
2. Tạo ví mới hoặc import ví Testnet sẵn có.
3. Trong Freighter, chọn network **Testnet**.
4. Chuẩn bị ba ví owner được liệt kê ở phần [Contract Testnet](#contract-testnet).

> Không gửi seed phrase, recovery phrase hoặc secret key cho bất kỳ ai. Project này không yêu cầu và không lưu những dữ liệu đó.

### 2. Cấp XLM Testnet cho ví

XLM Testnet là token thử nghiệm, không có giá trị thật. Stellar Friendbot cấp khoảng **10.000 XLM Testnet** cho một tài khoản mới hoặc tài khoản có số dư thấp.

Có hai cách:

- Trong Freighter: khi tài khoản chưa được cấp tiền trên Testnet, ví sẽ gợi ý nạp bằng Friendbot.
- Trong [Stellar Lab – Account](https://lab.stellar.org/account): chọn **Testnet**, nhập public address `G...`, sau đó chọn **Fund account with Friendbot / Get lumens**.

Stellar yêu cầu tài khoản giữ lại tối thiểu khoảng **1 XLM**. Vì vậy một ví Friendbot mới chỉ nên nạp vào treasury tối đa khoảng **9.999 XLM**.

### 3. Vì sao không nạp được 100.000 XLM?

Nút **Nạp quỹ** chuyển tiền từ ví Freighter vào contract; nó không tạo thêm XLM cho ví. Nếu ví chỉ có khoảng 10.000 XLM Testnet mà nhập `100000`, Stellar sẽ từ chối transaction.

Để demo dễ nhất, dùng khoản chi `100` hoặc `1000` XLM, rồi nạp trước `1000` hoặc `9000` XLM vào treasury.

---

## Demo hoàn chỉnh

Làm theo đúng thứ tự dưới đây. Đây là hướng dẫn cho người chưa dùng Stellar/Soroban.

### Bước 0 — Mở DApp và kiểm tra mạng

1. Chạy website theo phần [Chạy web trong 3 phút](#chạy-web-trong-3-phút).
2. Mở <http://localhost:3000>.
3. Kiểm tra góc trên có nhãn **TESTNET LIVE**.
4. Mở Freighter và bảo đảm đang chọn **Testnet**.

### Bước 1 — Nạp XLM vào treasury

1. Trong Freighter, chọn **Owner 01**.
2. Nhấn **Kết nối Freighter**. DApp chỉ chấp nhận ví thuộc danh sách owner.
3. Ở thẻ **Tài sản treasury**, nhấn **Nạp quỹ**.
4. Nhập `1000` XLM (hoặc nhỏ hơn số dư ví).
5. Nhấn **Mở Freighter để xác nhận**, kiểm tra transaction và ký.
6. Nhấn nút làm mới ở thẻ số dư treasury.

Sau bước này, số dư treasury phải lớn hơn hoặc bằng số tiền bạn định chi.

### Bước 2 — Tạo khoản chi mới

1. Vẫn giữ **Owner 01** đang kết nối.
2. Nhấn **Tạo khoản chi**.
3. Điền ví dụ:

   - Tên khoản chi: `Demo multisig`
   - Người nhận: một public address Testnet `G...` hợp lệ (có thể dùng public address Owner 02)
   - Số lượng: `100`
   - Mục đích: `Kiểm tra luồng ký 3 trên 3 trên Stellar Testnet`

4. Nhấn **Tạo proposal 0/3** và ký trong Freighter.
5. Proposal xuất hiện ở trạng thái `0/3`.

> Proposal `#00` trị giá 100.000 XLM đã tạo trước đó sẽ không thực thi được nếu treasury chưa có đủ 100.000 XLM. Hãy tạo proposal mới nhỏ hơn để demo.

### Bước 3 — Owner 01 ký chữ ký thứ nhất

1. Mở proposal vừa tạo.
2. Nhấn **Ký bằng Owner 01**.
3. Đọc lại người nhận, số tiền và mục đích.
4. Tích xác nhận, mở Freighter và ký transaction `approve`.

Proposal thành `1/3`.

### Bước 4 — Owner 02 ký chữ ký thứ hai

1. Trong Freighter, đổi sang **Owner 02**.
2. Trên DApp, nhấn **Ngắt phiên để đổi tài khoản**, sau đó **Kết nối Freighter** lại.
3. Mở đúng proposal đang ở `1/3`.
4. Nhấn **Ký bằng Owner 02** và ký trong Freighter.

Proposal thành `2/3`.

### Bước 5 — Owner 03 ký chữ ký cuối

1. Đổi Freighter sang **Owner 03**.
2. Ngắt phiên, kết nối lại DApp.
3. Mở đúng proposal và nhấn **Ký bằng Owner 03**.
4. Ký transaction trong Freighter.

Proposal đạt `3/3` và hiển thị “Đủ 3 chữ ký”.

### Bước 6 — Thực thi khoản chi

1. Giữ Owner 03, hoặc đổi sang bất kỳ owner nào.
2. Mở proposal đã `3/3`.
3. Nhấn **Thực thi khoản chi**.
4. Kiểm tra kỹ người nhận và số tiền, tích xác nhận.
5. Nhấn **Ký và thực thi** trong Freighter.

Proposal chuyển sang “Đã giải ngân” và số dư treasury giảm tương ứng.

---

## Contract Testnet

| Thuộc tính | Giá trị |
|---|---|
| Network | Stellar Testnet |
| Contract ID | `CAM5TLNZA3ETITVK7FWIVCE7XTLYDXLHCF75AVWEOODZCFQN5ZB4LMQB` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Ngưỡng phê duyệt | `3/3` |
| Owner 01 | `GCRKBBW7GN4KUYSCPMWE5N3RL3FJAQQYG4BHKH4L2QY5R7XX2LB22ZCK` |
| Owner 02 | `GAQ6FR2SYNHESJP4Q2QBDL527624IGCYTYIZBHVRU3GOIABKZZUNSXTU` |
| Owner 03 | `GBK36GGL2SBMP3AS54WSTXKTFH2XHSVSP2FUF2IG45ORETNOGU7UHVZN` |

- [Mở contract trên Stellar Lab](https://lab.stellar.org/r/testnet/contract/CAM5TLNZA3ETITVK7FWIVCE7XTLYDXLHCF75AVWEOODZCFQN5ZB4LMQB)
- Contract ban đầu có số dư `0 XLM`; số dư chỉ tăng sau khi một ví thực hiện `deposit` thành công.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| `Port 3000 is in use` | Có web khác đang chạy. Đóng Terminal cũ hoặc dùng chính <http://localhost:3000> nếu đó đã là bản mới. Không mở 3001 để tránh bản cũ. |
| `ENOENT package.json` | Bạn đang ở sai thư mục. Dùng `cd` để vào thư mục chứa `package.json`. |
| Không thấy Freighter | Cài/bật extension Freighter, sau đó tải lại trang. |
| Sai mạng | Trong Freighter chuyển sang **Testnet**, ngắt phiên và kết nối lại. |
| “Ví này không thuộc ba owner” | Chỉ ba public address trong bảng trên mới tạo, ký hoặc thực thi proposal. |
| Không nạp được 100.000 XLM | Ví Testnet thiếu tiền. Friendbot cấp khoảng 10.000 XLM; thử nạp `9000` XLM hoặc tạo proposal nhỏ hơn. |
| “Kho quỹ không đủ XLM” | Đã đủ chữ ký nhưng contract không có đủ tiền. Nạp thêm vào treasury rồi đồng bộ lại. |
| Owner đã ký nhưng số đếm chưa đổi | Nhấn đồng bộ, đợi Testnet ghi ledger vài giây hoặc tải lại trang. |
| Một owner ký hai lần | Contract từ chối theo thiết kế; hãy đổi sang owner chưa ký. |

## Kiểm tra source code

### Lệnh kiểm tra

```cmd
cargo test -p pdu-multisig-treasury
cargo build --target wasm32v1-none --release -p pdu-multisig-treasury
npm run lint
npm test
```

### Cấu trúc chính

```text
contracts/pdu_multisig_treasury/       Smart contract Rust + unit tests
packages/pdu-multisig-treasury-client/ TypeScript helpers
app/treasury-app.tsx                   Giao diện và luồng Freighter
app/stellar-treasury.ts                Soroban RPC, dựng/ký/gửi transaction
app/globals.css                        Giao diện website
docs/SOROBAN_STUDIO.md                 Hướng dẫn dùng Soroban Studio
pdu_multisig_treasury.wasm             WASM contract đã build
CHAY_WEB.bat                           File chạy nhanh Windows
```

### Các hàm contract

| Hàm | Mô tả |
|---|---|
| `deposit` | Chuyển XLM từ ví đã ký vào contract treasury. |
| `create_proposal` | Tạo proposal ở `0/3`. |
| `approve` | Owner ký đúng một lần bằng `require_auth()`. |
| `execute` | Chỉ chuyển tiền khi đã đủ 3/3 và treasury có đủ XLM. |
| `cancel_proposal` | Người tạo huỷ proposal khi chưa đạt threshold. |
| `get_config`, `get_proposal`, `treasury_balance` | Đọc trạng thái on-chain. |

## An toàn và tài liệu

- Chỉ dùng **Stellar Testnet**; XLM ở đây không phải tiền thật.
- Không commit file `.env.local`, secret key, seed phrase hoặc recovery phrase.
- Project chưa qua audit bảo mật; không dùng cho Mainnet hay quỹ thật.
- Luôn kiểm tra địa chỉ, số tiền và mục đích trong Freighter trước khi ký.

Tài liệu tham khảo:

- [Stellar Smart Contracts – Hello World](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world)
- [Soroban authorization với `require_auth()`](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization)
- [Stellar Lab – Fund account with Friendbot](https://developers.stellar.org/docs/tools/lab/account)
- [Soroban Studio](https://soroban.studio/)
- [stellar-notes-dapp](https://github.com/minhbear/stellar-notes-dapp) — tham khảo cấu trúc học tập
