resource "aws_s3_bucket" "data_bucket" {
  bucket = var.s3_bucket_name != null ? var.s3_bucket_name : "${var.project_name}-data-bucket"
  force_destroy = false
  tags = {
    Name = "${var.project_name}-data-bucket"
  }
}

output "bucket_name" {
  value = aws_s3_bucket.data_bucket.id
}
