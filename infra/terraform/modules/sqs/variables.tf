variable "name" {
  description = "Name of the standard SQS queue."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{1,80}$", var.name))
    error_message = "Use 1-80 letters, digits, hyphens or underscores for a standard queue name."
  }
}

variable "visibility_timeout_seconds" {
  description = "Time a received message stays hidden; must cover consumer processing time."
  type        = number
  default     = 30

  validation {
    condition     = var.visibility_timeout_seconds >= 0 && var.visibility_timeout_seconds <= 43200 && floor(var.visibility_timeout_seconds) == var.visibility_timeout_seconds
    error_message = "Use an integer visibility timeout between 0 and 43200 seconds."
  }
}
