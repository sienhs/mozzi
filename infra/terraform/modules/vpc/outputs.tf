output "id" {
  value = aws_vpc.this.id
}
output "cidr" {
  value = aws_vpc.this.cidr_block
}
output "internet_gateway_id" {
  value = aws_internet_gateway.this.id
}
