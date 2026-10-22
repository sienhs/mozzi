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
  region              = var.aws_region
  allowed_account_ids = var.aws_account_id == null ? null : [var.aws_account_id]
  default_tags {
    tags = { Project = var.name_prefix, ManagedBy = "Terraform", Environment = "dev" }
  }
}

module "backend_ecr" {
  source = "./modules/ecr"

  repository_name = "mozzi-backend"
}

data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "zone-type"
    values = ["availability-zone"]
  }
}

locals {
  # AZ IDs identify physical zones consistently across AWS accounts.
  worker_az_ids = slice(sort(tolist(setsubtract(toset(data.aws_availability_zones.available.zone_ids), toset(["apne2-az1"])))), 0, 2)
  zones = {
    for index, az_id in local.worker_az_ids : az_id => {
      public_cidr  = cidrsubnet("10.50.0.0/16", 8, index + 1)
      private_cidr = cidrsubnet("10.50.0.0/16", 8, index + 11)
    }
  }
}

module "vpc" {
  source = "./modules/vpc"
  name   = var.name_prefix
  cidr   = "10.50.0.0/16"
}

module "public_subnet" {
  source   = "./modules/subnet"
  for_each = local.zones

  name                = "${var.name_prefix}-public-${each.key}"
  vpc_id              = module.vpc.id
  cidr                = each.value.public_cidr
  az_id               = each.key
  public              = true
  internet_gateway_id = module.vpc.internet_gateway_id
}

module "private_subnet" {
  source   = "./modules/subnet"
  for_each = local.zones

  name   = "${var.name_prefix}-private-${each.key}"
  vpc_id = module.vpc.id
  cidr   = each.value.private_cidr
  az_id  = each.key
}

module "worker_security_group" {
  source = "./modules/security-group"

  name            = "${var.name_prefix}-workers"
  vpc_id          = module.vpc.id
  wireguard_cidrs = var.wireguard_allowed_cidrs
}

data "aws_ssm_parameter" "ubuntu" {
  count = var.worker_ami_id == null ? 1 : 0
  name  = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

module "worker" {
  source   = "./modules/ec2"
  for_each = local.zones

  name              = "${var.name_prefix}-worker-${each.key}"
  subnet_id         = module.public_subnet[each.key].id
  security_group_id = module.worker_security_group.id
  ami_id            = var.worker_ami_id != null ? var.worker_ami_id : data.aws_ssm_parameter.ubuntu[0].value
  instance_type     = var.worker_instance_type
  key_name          = var.ssh_key_name
  root_volume_size  = var.worker_root_volume_size
}
