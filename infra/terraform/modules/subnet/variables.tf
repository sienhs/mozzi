variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "cidr" {
  type = string
}
variable "az_id" {
  type = string
}
variable "internet_gateway_id" {
  description = "Internet gateway required when public is true."
  type        = string
  default     = null
}
variable "public" {
  description = "Whether to add an internet default route."
  type        = bool
  default     = false
}
