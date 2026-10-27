output "url" {
  description = "Queue URL for sending and receiving messages."
  value       = aws_sqs_queue.this.url
}

output "arn" {
  description = "Queue ARN for IAM permissions."
  value       = aws_sqs_queue.this.arn
}

output "name" {
  description = "Queue name."
  value       = aws_sqs_queue.this.name
}
