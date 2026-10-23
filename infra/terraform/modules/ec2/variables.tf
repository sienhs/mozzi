variable "name" {
  type = string
}
variable "ami_id" {
  type = string
}
variable "instance_type" {
  type = string
}
variable "subnet_id" {
  type = string
}
variable "security_group_id" {
  type = string
}
variable "key_name" {
  type = string
}
variable "root_volume_size" {
  type = number
}
variable "associate_public_ip_address" {
  type    = bool
  default = false
}
variable "source_dest_check" {
  type    = bool
  default = true
}
variable "role" {
  type    = string
  default = "k3s-worker"
}
