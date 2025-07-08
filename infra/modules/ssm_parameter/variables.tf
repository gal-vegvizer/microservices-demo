variable "name" {
  description = "The name of the SSM parameter"
  type        = string
}

variable "description" {
  description = "Description for the SSM parameter"
  type        = string
  default     = "Token for API authentication"
}

variable "value" {
  description = "The value of the SSM parameter"
  type        = string
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
}
