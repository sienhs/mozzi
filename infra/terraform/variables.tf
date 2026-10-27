variable "aws_region" {
  description = "AWS region for infrastructure resources."
  type        = string
  default     = "ap-northeast-2"
  validation {
    condition     = var.aws_region == "ap-northeast-2"
    error_message = "This deployment uses Seoul AZ IDs and must remain in ap-northeast-2."
  }
}

variable "aws_account_id" {
  description = "Optional AWS account guard. Null uses the account of the existing AWS credentials."
  type        = string
  default     = null
  validation {
    condition     = var.aws_account_id == null || can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Provide a 12-digit personal AWS account ID."
  }
}

variable "name_prefix" {
  description = "Prefix for resource names and project tags."
  type        = string
  default     = "mozzi-dev"
}

variable "ai_request_visibility_timeout_seconds" {
  description = "Visibility timeout for AI requests; set above the longest AI processing time or extend it while processing."
  type        = number
  default     = 900
}

variable "ai_response_visibility_timeout_seconds" {
  description = "Visibility timeout for AI responses consumed by the backend."
  type        = number
  default     = 60
}

variable "ssh_key_name" {
  description = "Existing EC2 key pair name in the personal account's Seoul region. No private key is stored in Terraform."
  type        = string
  validation {
    condition     = length(trimspace(var.ssh_key_name)) > 0
    error_message = "An existing key pair name is required."
  }
}

variable "wireguard_allowed_cidrs" {
  description = "SSAFY public IPv4 CIDRs allowed to reach gateway UDP 51820."
  type        = set(string)
  validation {
    condition     = length(var.wireguard_allowed_cidrs) > 0 && alltrue([for cidr in var.wireguard_allowed_cidrs : can(cidrnetmask(cidr)) && try(tonumber(split("/", cidr)[1]) >= 24, false)])
    error_message = "Provide IPv4 CIDRs with /24 or narrower prefixes; prefer the SSAFY public IP /32."
  }
}

variable "availability_zone_id" {
  description = "Single physical AZ for gateway, subnets and workers; defaults to the SSAFY server's AZ."
  type        = string
  default     = "apne2-az1"
  validation {
    condition     = can(regex("^apne2-az[0-9]+$", var.availability_zone_id))
    error_message = "Use a Seoul physical availability zone ID such as apne2-az1."
  }
}

variable "gateway_instance_type" {
  description = "x86_64 T3 size for the shared VPN/NAT/bastion server."
  type        = string
  default     = "t3.micro"
  validation {
    condition     = contains(["t3.micro", "t3.small", "t3.medium", "t3.large"], var.gateway_instance_type)
    error_message = "Choose an x86_64 t3.micro, small, medium or large gateway."
  }
}

variable "worker_instance_type" {
  description = "Worker instance type. This configuration uses an x86_64 Ubuntu AMI."
  type        = string
  default     = "t3.small"
  validation {
    condition     = contains(["t3.small", "t3.medium", "t3.large", "t3.xlarge"], var.worker_instance_type)
    error_message = "Choose a supported x86_64 t3 worker size: small, medium, large or xlarge."
  }
}

variable "worker_ami_id" {
  description = "Pinned Ubuntu 24.04 x86_64 AMI in Seoul, shared by gateway and workers. Use the currently running instances' AMI to avoid replacement."
  type        = string
  default     = "ami-05b2d28c4a1614552"
  nullable    = false
  validation {
    condition     = can(regex("^ami-[0-9a-f]{17}$", var.worker_ami_id))
    error_message = "Set worker_ami_id to a fixed Ubuntu 24.04 x86_64 AMI ID (ami- followed by 17 hexadecimal characters)."
  }
}

variable "worker_root_volume_size" {
  description = "Encrypted gp3 root volume size per worker, in GiB."
  type        = number
  default     = 30
  validation {
    condition     = var.worker_root_volume_size >= 20 && floor(var.worker_root_volume_size) == var.worker_root_volume_size
    error_message = "Use an integer root volume size of at least 20 GiB."
  }
}
variable "db_username" {
  description = "User-supplied PostgreSQL master username; no default is provided."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,62}$", var.db_username))
    error_message = "Use 1-63 characters, starting with a letter, followed by letters, digits or underscores. RDS reserved usernames are not allowed."
  }
}

variable "db_password" {
  description = "User-supplied PostgreSQL master password. Supply through TF_VAR_db_password or a private tfvars file."
  type        = string
  sensitive   = true
  nullable    = false
  validation {
    condition     = length(var.db_password) >= 8 && length(var.db_password) <= 128 && can(regex("^[!-~]+$", var.db_password)) && !can(regex("[/\"@]", var.db_password))
    error_message = "Use 8-128 printable ASCII characters excluding spaces, /, double quotes and @."
  }
}

variable "rds_secondary_availability_zone_id" {
  description = "Second Seoul AZ for the RDS subnet group; must differ from availability_zone_id."
  type        = string
  default     = "apne2-az2"
  validation {
    condition     = can(regex("^apne2-az[0-9]+$", var.rds_secondary_availability_zone_id))
    error_message = "Use a Seoul physical availability zone ID such as apne2-az2."
  }
}
