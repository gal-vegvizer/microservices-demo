variable "project_name" {
  description = "Project name prefix for resources."
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for ECS service."
  type        = string
}

variable "ecs_task_role_arn" {
  description = "IAM role ARN for ECS tasks."
  type        = string
}

variable "container_image" {
  description = "Docker image for the ECS service."
  type        = string
}

variable "container_port" {
  description = "Port the container listens on."
  type        = number
  default     = 8080
}

variable "security_group_id" {
  description = "Security group ID for the ECS service."
  type        = string
}

variable "target_group_arn" {
  description = "ARN of the ALB target group (optional, for services behind ALB)."
  type        = string
  default     = null
}
