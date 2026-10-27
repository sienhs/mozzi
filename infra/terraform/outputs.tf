output "backend_ecr_repository_url" {
  description = "Repository URL used to push backend container images."
  value       = module.backend_ecr.repository_url
}

output "vpc_id" {
  value = module.vpc.id
}

output "availability_zone_id" {
  value = var.availability_zone_id
}

output "subnet_ids" {
  value = {
    public  = module.public_subnet.id
    private = module.private_subnet.id
  }
}

output "gateway" {
  description = "Public VPN/NAT gateway and SSH jump host. WireGuard peer setup is a separate step."
  value = {
    instance_id = module.gateway.id
    public_ip   = aws_eip.gateway.public_ip
    private_ip  = module.gateway.private_ip
    ssh_command = "ssh -i <personal-key.pem> ubuntu@${aws_eip.gateway.public_ip}"
  }
}

output "workers" {
  description = "Private workers; use the public gateway as an SSH ProxyJump."
  value = {
    for name, worker in module.worker : name => {
      instance_id = worker.id
      private_ip  = worker.private_ip
      subnet_id   = module.private_subnet.id
      ssh_command = "ssh -o IdentitiesOnly=yes -o 'ProxyCommand=ssh -i <personal-key.pem> -W %h:%p ubuntu@${aws_eip.gateway.public_ip}' -i <personal-key.pem> ubuntu@${worker.private_ip}"
    }
  }
}

output "rds" {
  description = "Private PostgreSQL connection details; credentials are supplied separately."
  value       = module.rds.connection
}
