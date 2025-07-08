variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "microdemo"
}

variable "state_bucket_name" {
  description = "Name for the S3 bucket to store Terraform state"
  type        = string
  default     = "microdemo-terraform-state-bucket"
}

variable "dynamodb_table_name" {
  description = "Name for the DynamoDB table for state locking"
  type        = string
  default     = "microdemo-terraform-locks"
}
