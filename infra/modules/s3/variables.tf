variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "s3_bucket_name" {
  description = "Name for the S3 bucket."
  type        = string
  default     = null
}
