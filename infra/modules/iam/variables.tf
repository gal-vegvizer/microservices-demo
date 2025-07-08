variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket to allow access."
  type        = string
}

variable "sqs_queue_arn" {
  description = "ARN of the SQS queue to allow access."
  type        = string
}

variable "ssm_param_arn" {
  description = "ARN of the SSM parameter to allow access."
  type        = string
}
