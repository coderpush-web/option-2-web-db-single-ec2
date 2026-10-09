
variable "aws_region" {
  type        = string
  description = "AWS Deployment Region"
  default     = "ap-southeast-1"
}

variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
  default     = "prod"
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "volume_size" {
  type    = number
  default = 50
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "ProdSecret123!"
}
