terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  backend "http" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "backend_ecr" {
  source = "./modules/ecr"

  repository_name = "mozzi-backend"
}

output "backend_ecr_repository_url" {
  description = "Repository URL used to push backend container images."
  value       = module.backend_ecr.repository_url
}
