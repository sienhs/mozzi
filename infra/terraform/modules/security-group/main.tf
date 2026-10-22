resource "aws_security_group" "this" {
  name_prefix = "${var.name}-"
  description = "Worker SSH and WireGuard ingress only"
  vpc_id      = var.vpc_id
  tags        = { Name = var.name }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.this.id
  description       = "SSH from dynamic administrator IPv4 addresses"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "wireguard" {
  for_each          = var.wireguard_cidrs
  security_group_id = aws_security_group.this.id
  description       = "SSAFY WireGuard peer"
  cidr_ipv4         = each.value
  ip_protocol       = "udp"
  from_port         = 51820
  to_port           = 51820
}

resource "aws_vpc_security_group_ingress_rule" "worker_wireguard" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = aws_security_group.this.id
  description                  = "Worker WireGuard over private VPC addresses"
  ip_protocol                  = "udp"
  from_port                    = 51820
  to_port                      = 51820
}

resource "aws_vpc_security_group_egress_rule" "outbound" {
  security_group_id = aws_security_group.this.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
