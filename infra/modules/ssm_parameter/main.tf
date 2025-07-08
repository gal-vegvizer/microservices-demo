resource "aws_ssm_parameter" "this" {
  name        = var.name
  description = var.description
  type        = "SecureString"
  value       = var.value
  tags = {
    Project = var.project_name
  }
}
