output "connection" {
  description = "Private PostgreSQL connection details; credentials are supplied separately."
  value = {
    identifier = aws_db_instance.postgresql.identifier
    address    = aws_db_instance.postgresql.address
    port       = aws_db_instance.postgresql.port
    endpoint   = aws_db_instance.postgresql.endpoint
  }
}
