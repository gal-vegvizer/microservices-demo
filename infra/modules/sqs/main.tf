resource "aws_sqs_queue" "main" {
  name = var.sqs_queue_name != null ? var.sqs_queue_name : "${var.project_name}-queue"
  tags = {
    Name = "${var.project_name}-queue"
  }
}

output "queue_url" {
  value = aws_sqs_queue.main.id
}
