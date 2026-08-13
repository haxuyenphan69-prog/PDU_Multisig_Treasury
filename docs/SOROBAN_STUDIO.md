# Mở contract bằng Soroban Studio

1. Mở <https://soroban.studio/> và chọn **Create Project**.
2. Tải file `pdu_multisig_treasury.wasm` ở thư mục gốc lên project.
3. Studio sẽ đọc contract spec nằm bên trong WASM và hiển thị các hàm public.
4. Để xem source, mở `contracts/pdu_multisig_treasury/src/lib.rs`. Soroban Studio chủ yếu chạy WASM, không tự khôi phục Rust source từ WASM.

Nếu terminal Studio báo `Failed to fetch`, đó thường là lỗi kết nối dịch vụ Studio. WASM vẫn có thể kiểm tra bằng Stellar Lab hoặc Stellar CLI.
