variable "name" {
  description = "Prefix for RDS resource names."
  type        = string
}

variable "vpc_id" {
  description = "VPC containing the database and workers."
  type        = string
}

variable "primary_subnet_id" {
  description = "Existing private subnet for the RDS subnet group."
  type        = string
}

variable "primary_availability_zone_id" {
  description = "Physical AZ ID of the existing private subnet."
  type        = string
}

variable "secondary_availability_zone_id" {
  description = "Different physical AZ ID for the second RDS subnet."
  type        = string
}

variable "secondary_subnet_cidr" {
  description = "Unused VPC CIDR block for the second private RDS subnet."
  type        = string
}

variable "worker_security_group_id" {
  description = "Worker security group allowed to connect to PostgreSQL."
  type        = string
}

variable "gateway_security_group_id" {
  description = "Gateway security group allowed to connect to PostgreSQL through SSH tunnels."
  type        = string
}

variable "db_username" {
  description = "User-supplied PostgreSQL master username."
  type        = string
  nullable    = false
}

variable "db_password" {
  description = "User-supplied PostgreSQL master password."
  type        = string
  sensitive   = true
  nullable    = false
}
