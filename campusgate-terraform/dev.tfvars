# dev.tfvars  (CLEANED)
env = "dev"

# RG where the EXISTING Storage Account lives
rg_storage = "campusgate-rg"

# RG where the EXISTING Cosmos DB Account lives
rg_cosmos = "vms"

# Existing resource names
storage_name    = "svmstorage"
cosmos_acc_name = "svmscosmosdb"

# New resources to be created by Terraform
ai_name   = "campusgate-ai"
kv_name   = "kvcampusgate"
plan_name = "plan-campusgate-dev"
func_name = "func-campusgate-dev"

# Optional (only if you use it somewhere)
swa_name = ""
