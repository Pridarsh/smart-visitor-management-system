variable "env" { type = string }
variable "rg_storage" { type = string } # e.g., "campusgate-rg"
variable "rg_cosmos" { type = string }  # e.g., "vms"

variable "storage_name" { type = string }    # e.g., "svmstorage"
variable "cosmos_acc_name" { type = string } # the actual Cosmos account name

variable "blob_container_passes" {
  type        = string
  default     = "passes"
  description = "Blob container for QR images"
}

variable "ai_name" { type = string }
variable "kv_name" { type = string }
variable "plan_name" { type = string }
variable "func_name" { type = string }

# optional if you ever reference it later
variable "swa_name" {
  type        = string
  default     = ""
  description = "Optional Static Web App name (leave blank if not used)"
}

