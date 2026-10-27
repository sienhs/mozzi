output "bucket_name" {
  value = aws_s3_bucket.backend.id
}

output "bucket_arn" {
  value = aws_s3_bucket.backend.arn
}

output "public_base_url" {
  value = "https://${aws_s3_bucket.backend.bucket_regional_domain_name}"
}
