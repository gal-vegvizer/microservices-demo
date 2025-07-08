variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "sqs_queue_name" {
  description = "Name for the SQS queue."
  type        = string
  default     = null
}
