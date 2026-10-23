output "id" {
  value      = aws_subnet.this.id
  depends_on = [aws_route_table_association.this, aws_route.internet]
}
output "route_table_id" {
  value = aws_route_table.this.id
}
