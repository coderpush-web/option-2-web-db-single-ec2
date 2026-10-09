terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 Remote State Backend an toàn & bảo mật
  backend "s3" {
    bucket         = "coderpush-terraform-states-ap-southeast-1"
    key            = "option-2-web-db-single-ec2/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "coderpush-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-default-x86_64"]
  }
}

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
}

module "security" {
  source      = "./modules/security"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
}

module "iam" {
  source      = "./modules/iam"
  environment = var.environment
}


resource "aws_instance" "server" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = module.vpc.public_subnet_id
  vpc_security_group_ids = [module.security.web_security_group_id]
  iam_instance_profile   = module.iam.instance_profile_name

  root_block_device {
    volume_size           = var.volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y nodejs npm mariadb105-server
              systemctl enable mariadb && systemctl start mariadb
              EOF

  tags = {
    Name        = "${var.environment}-combined-server"
    Environment = var.environment
  }
}

resource "aws_eip" "server" {
  instance = aws_instance.server.id
  domain   = "vpc"

  tags = {
    Name        = "${var.environment}-server-eip"
    Environment = var.environment
  }
}

output "website_url" {
  value = "http://${aws_eip.server.public_ip}"
}

