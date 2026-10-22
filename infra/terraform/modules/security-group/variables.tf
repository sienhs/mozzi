variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "wireguard_cidrs" {
  type = set(string)
}
