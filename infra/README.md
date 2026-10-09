# Infrastructure Modules - option-2-web-db-single-ec2

Thư mục này chứa đầy đủ các module CloudFormation độc lập, hỗ trợ cả hai môi trường **Development (dev)** và **Production (prod)**.

## 1. Cấu trúc Modules
- `modules/vpc-subnets.yaml`: Khởi tạo VPC, Internet Gateway, 1 Public Subnet (Web) và 2 Private Subnets (Multi-AZ).
- `modules/security-groups.yaml`: Quản lý Security Group cho Web (port 80/443) và DB (port 3306).
- `modules/iam-roles.yaml`: IAM Instance Profile cho AWS SSM Session Manager.
- `modules/app.yaml`: Khởi tạo tài nguyên tính toán (EC2 / RDS) tùy biến theo biến môi trường.

## 2. Quản lý Môi trường (Environments)
- `environments/dev.json`: Cấu hình tiết kiệm tối đa cho Dev (EC2/RDS micro, dung lượng ổ đĩa nhỏ).
- `environments/prod.json`: Cấu hình chuẩn High-Availability & Performance cho Production (Reserved/Savings Plans, 4GB RAM / RDS Graviton).

## 3. Cách triển khai (One-click Deployment)
```bash
# Triển khai môi trường Dev:
./deploy.sh dev

# Triển khai môi trường Production:
./deploy.sh prod
```
