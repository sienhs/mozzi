output "id" {
  value      = aws_subnet.this.id
  depends_on = [aws_route_table_association.this, aws_route.internet]
}
