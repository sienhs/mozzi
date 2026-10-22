output "backend_ecr_repository_url" {
  description = "Repository URL used to push backend container images."
  value       = module.backend_ecr.repository_url
}

output "vpc_id" {
  value = module.vpc.id
}

output "private_subnet_ids" {
  description = "Isolated subnets reserved for a future RDS subnet group; no RDS is created."
  value       = { for az, subnet in module.private_subnet : az => subnet.id }
}

output "worker_security_group_id" {
  value = module.worker_security_group.id
}

output "workers" {
  description = "Worker inventory, including physical AZ IDs and SSH endpoints."
  value = {
    for az, worker in module.worker : az => {
      instance_id = worker.id
      public_ip   = worker.public_ip
      private_ip  = worker.private_ip
      subnet_id   = module.public_subnet[az].id
      ssh_command = "ssh -i <personal-key.pem> ubuntu@${worker.public_ip}"
    }
  }
}
