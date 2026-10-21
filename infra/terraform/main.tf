terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  backend "http" {}
}

# Persist a visible value without creating resources or requiring AWS credentials.
output "backend_smoke_test" {
  description = "Confirms that the resource-free configuration was applied."
  value       = "GitLab Terraform state is ready"
}
