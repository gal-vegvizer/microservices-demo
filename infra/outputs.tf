output "vpc_id" {
  value = aws_vpc.main.id
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.data_bucket.id
}

output "sqs_queue_url" {
  value = aws_sqs_queue.main.id
}
