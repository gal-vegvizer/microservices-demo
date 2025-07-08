variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the ALB."
  type        = string
}

# subnet_id is now replaced by subnet_ids for multi-AZ support
# variable "subnet_id" {
#   description = "Subnet ID for the ALB."
#   type        = string
# }

variable "subnet_ids" {
  description = "List of public subnet IDs for the ALB."
  type        = list(string)
}

variable "target_port" {
  description = "Port for the target group (ECS service)."
  type        = number
  default     = 8080
}
