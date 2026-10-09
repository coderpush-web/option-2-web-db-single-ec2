# Option 2: Web Application + Local MySQL DB on Single EC2

Hạ tầng và Mã nguồn ứng dụng độc lập cho **Option 2: Web Application + Local MySQL DB on Single EC2**.

## 1. Cấu trúc thư mục (File Structure)
```text
.
├── .github/workflows/ci-cd.yml   # CI/CD Pipeline (test code, lint CloudFormation, auto-deploy)
├── app/                          # Mã nguồn Website độc lập (Node.js/Express)
├── infra/                        # Mã nguồn CloudFormation hạ tầng AWS
│   ├── cloudformation.yaml       # Template CloudFormation độc lập
│   └── architecture_diagram.png  # Sơ đồ kiến trúc Diagram-as-Code
├── test/                         # Kiểm thử tự động (Unit test API & app)
│   └── test_api.js
└── README.md                     # Báo cáo kỹ thuật và ma trận chi phí
```

## 2. Báo cáo Chi phí Đa Chiều (Multi-Dimension Cost Analysis)

### A. Chi phí theo Mô hình Thanh toán (Khuyên dùng tối thiểu t3.medium 4GB RAM)
| Mô hình thanh toán | Đơn giá EC2 Compute | Thành phần phụ (IP + 50GB EBS + Backup) | Tổng chi phí / tháng | Quy đổi VNĐ |
| :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Mặc định)** | $30.37 / tháng | $9.15 / tháng | **$39.52 / tháng** | ~998.000 VNĐ |
| **1-Year Savings Plan (Cam kết 1 năm)** | $19.13 / tháng | $9.15 / tháng | **$28.28 / tháng** *(Giảm 28%)* | ~714.000 VNĐ |
| **3-Year Savings Plan (Cam kết 3 năm)** | $12.13 / tháng | $9.15 / tháng | **$21.28 / tháng** *(Giảm 46%)* | ~537.000 VNĐ |
| **Spot Instance (Dev/Test)** | $9.07 / tháng | $9.15 / tháng | **$18.22 / tháng** *(Không khuyên dùng cho DB)* | ~460.000 VNĐ |

## 3. Kiến trúc Hạ tầng (Architecture Diagram)
![Architecture](infra/architecture_diagram.png)

## 4. Quy trình CI/CD & Branching Strategy
- **dev**: Nhánh phát triển chính. Tự động chạy kiểm thử khi push/PR.
- **main**: Nhánh Production được bảo vệ (**Branch Protection Rule**). Chỉ cho phép merge từ nhánh **dev**.
