# RDS requires subnets in two AZs even for a Single-AZ DB instance.
module "rds_secondary_subnet" {
  source = "../subnet"

  name   = "${var.name}-rds-secondary"
  vpc_id = var.vpc_id
  cidr   = var.secondary_subnet_cidr
  az_id  = var.secondary_availability_zone_id
}

resource "aws_db_subnet_group" "postgresql" {
  name       = "${var.name}-postgresql"
  subnet_ids = [var.primary_subnet_id, module.rds_secondary_subnet.id]

  lifecycle {
    precondition {
      condition     = var.secondary_availability_zone_id != var.primary_availability_zone_id
      error_message = "RDS subnet group subnets must use two different availability zones."
    }
  }
}

resource "aws_security_group" "postgresql" {
  name_prefix = "${var.name}-postgresql-"
  description = "PostgreSQL access from application workers"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-postgresql" }
}

resource "aws_vpc_security_group_ingress_rule" "postgresql_workers" {
  security_group_id            = aws_security_group.postgresql.id
  referenced_security_group_id = var.worker_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL from application workers"
}

resource "aws_vpc_security_group_ingress_rule" "postgresql_gateway" {
  security_group_id            = aws_security_group.postgresql.id
  referenced_security_group_id = var.gateway_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL through SSH gateway"
}

resource "aws_db_instance" "postgresql" {
  identifier = "${var.name}-postgresql"
  engine     = "postgres"
  # Create the application database with the instance; Flyway manages its schema.
  db_name = "mozzi"
  # Pin the major version while allowing RDS to select a supported minor release.
  engine_version = "17"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 0
  storage_type          = "gp3"
  storage_encrypted     = true

  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.postgresql.name
  vpc_security_group_ids = [aws_security_group.postgresql.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${var.name}-postgresql-final"
  tags                       = { Name = "${var.name}-postgresql" }
}
