variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "ingress_rules" {
  description = "Ingress rules keyed by stable names; omitted ports are used for all-protocol rules."
  type = map(object({
    description = string
    cidr        = string
    protocol    = string
    from_port   = optional(number)
    to_port     = optional(number)
  }))
}
