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

<!-- INFRACOST_START -->
### 💵 Kết quả Kiểm tra Chi phí Tự động (Infracost CI/CD Output)
*Thời gian kiểm tra: Fri Oct  9 06:03:03 UTC 2026*

```text
Resource                                                  Count  Monthly Cost
aws_instance.server                                           2           $87
module.iam.aws_iam_instance_profile.this                      2            $0
module.vpc.aws_subnet.private_1                               2            $0
module.vpc.aws_subnet.private_2                               2            $0
module.vpc.aws_subnet.public                                  2            $0
module.vpc.aws_vpc.this                                       2            $0
aws_eip.server                                                2            $0
module.iam.aws_iam_role.ssm_role                              2            $0
module.iam.aws_iam_role_policy_attachment.ssm_attachment      2            $0
module.security.aws_security_group.db                         2            $0
module.security.aws_security_group.web                        2            $0
module.vpc.aws_internet_gateway.this                          2            $0
module.vpc.aws_route_table.public                             2            $0
module.vpc.aws_route_table_association.public                 2            $0
```
<!-- INFRACOST_END -->

## 3. Kiến trúc Hạ tầng (Architecture Diagram)
![Architecture](infra/architecture_diagram.png)

## 4. Quy trình CI/CD & Branching Strategy
- **dev**: Nhánh phát triển chính. Tự động chạy kiểm thử khi push/PR.
- **main**: Nhánh Production được bảo vệ (**Branch Protection Rule**). Chỉ cho phép merge từ nhánh **dev**.

## 🔒 Bảo Mật & Quản Lý Trạng Thái Hạ Tầng (Terraform State on S3)
Toàn bộ trạng thái hạ tầng được lưu trữ và bảo vệ nghiêm ngặt:
- **Lưu trữ từ xa (Remote State):** Amazon S3 Bucket `coderpush-terraform-states-ap-southeast-1`.
- **Mã hóa dữ liệu tại chỗ (Encryption at Rest):** Bật mã hóa `encrypt = true` (AES-256) ngăn ngừa mọi truy cập trái phép.
- **Khóa trạng thái (State Locking):** Tích hợp Amazon DynamoDB Table `coderpush-terraform-locks` ngăn xung đột khi nhiều kỹ sư hoặc pipeline chạy đồng thời.
- **Phân tách môi trường:** Khóa phân lập `environments/dev.tfvars` và `environments/prod.tfvars`.
