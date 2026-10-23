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

locals {
  vpc_cidr     = "10.50.0.0/16"
  public_cidr  = "10.50.1.0/24"
  private_cidr = "10.50.11.0/24"
  ami_id       = var.worker_ami_id != null ? var.worker_ami_id : data.aws_ssm_parameter.ubuntu[0].value
}

module "vpc" {
  source = "./modules/vpc"
  name   = var.name_prefix
  cidr   = local.vpc_cidr
}

module "public_subnet" {
  source = "./modules/subnet"

  name                = "${var.name_prefix}-public"
  vpc_id              = module.vpc.id
  cidr                = local.public_cidr
  az_id               = var.availability_zone_id
  public              = true
  internet_gateway_id = module.vpc.internet_gateway_id
}

module "private_subnet" {
  source = "./modules/subnet"

  name   = "${var.name_prefix}-private"
  vpc_id = module.vpc.id
  cidr   = local.private_cidr
  az_id  = var.availability_zone_id
}

module "gateway_security_group" {
  source = "./modules/security-group"

  name   = "${var.name_prefix}-gateway"
  vpc_id = module.vpc.id
  ingress_rules = merge({
    ssh = {
      description = "SSH from dynamic administrator IPv4 addresses"
      cidr        = "0.0.0.0/0"
      protocol    = "tcp"
      from_port   = 22
      to_port     = 22
    }
    private_traffic = {
      description = "Private subnet egress and routed VPN traffic"
      cidr        = local.private_cidr
      protocol    = "-1"
    }
    }, {
    for cidr in var.wireguard_allowed_cidrs : "wireguard-${cidr}" => {
      description = "SSAFY WireGuard peer"
      cidr        = cidr
      protocol    = "udp"
      from_port   = 51820
      to_port     = 51820
    }
  })
}

module "worker_security_group" {
  source = "./modules/security-group"

  name   = "${var.name_prefix}-workers"
  vpc_id = module.vpc.id
  ingress_rules = {
    vpc = {
      description = "VPC internal node traffic and SSH through gateway"
      cidr        = local.vpc_cidr
      protocol    = "-1"
    }
    vpn = {
      description = "Routed control plane traffic from VPN"
      cidr        = "10.200.0.0/24"
      protocol    = "-1"
    }
  }
}

data "aws_ssm_parameter" "ubuntu" {
  count = var.worker_ami_id == null ? 1 : 0
  name  = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

module "gateway" {
  source = "./modules/ec2"

  name                        = "${var.name_prefix}-vpn-nat"
  role                        = "vpn-nat-gateway"
  subnet_id                   = module.public_subnet.id
  security_group_id           = module.gateway_security_group.id
  ami_id                      = local.ami_id
  instance_type               = var.gateway_instance_type
  key_name                    = var.ssh_key_name
  root_volume_size            = 20
  associate_public_ip_address = true
  source_dest_check           = false
  user_data                   = templatefile("${path.module}/templates/gateway.sh.tftpl", { private_cidr = local.private_cidr })
}

resource "aws_eip" "gateway" {
  domain   = "vpc"
  instance = module.gateway.id
  tags     = { Name = "${var.name_prefix}-vpn-nat" }
}

resource "aws_route" "private_egress" {
  route_table_id         = module.private_subnet.route_table_id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = module.gateway.primary_network_interface_id
}

module "worker" {
  source   = "./modules/ec2"
  for_each = toset(["worker-1", "worker-2"])

  name              = "${var.name_prefix}-${each.key}"
  subnet_id         = module.private_subnet.id
  security_group_id = module.worker_security_group.id
  ami_id            = local.ami_id
  instance_type     = var.worker_instance_type
  key_name          = var.ssh_key_name
  root_volume_size  = var.worker_root_volume_size

  depends_on = [aws_route.private_egress, aws_eip.gateway]
}
