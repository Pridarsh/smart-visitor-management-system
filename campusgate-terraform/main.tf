locals {
  tags = { app = "campusgate", env = var.env }
}

# --- 0) EXISTING RGs ---
data "azurerm_resource_group" "rg_storage" {
  name = var.rg_storage # campusgate-rg
}

data "azurerm_resource_group" "rg_cosmos" {
  name = var.rg_cosmos # vms
}

# --- Existing storage account (in campusgate-rg) ---
data "azurerm_storage_account" "st" {
  name                = var.storage_name # svmstorage
  resource_group_name = data.azurerm_resource_group.rg_storage.name
}

# --- Existing Cosmos account (in vms) ---
data "azurerm_cosmosdb_account" "cosmos" {
  name                = var.cosmos_acc_name
  resource_group_name = data.azurerm_resource_group.rg_cosmos.name
}

# --- 1) Storage child resources (stay tied to storage account) ---
resource "azurerm_storage_container" "passes" {
  name                  = var.blob_container_passes
  storage_account_name  = data.azurerm_storage_account.st.name
  container_access_type = "private"
}

resource "azurerm_storage_queue" "pass_requests" {
  name                 = "visitor-pass-requests"
  storage_account_name = data.azurerm_storage_account.st.name
}

# --- 2) Cosmos SQL DB + container (MUST be in Cosmos RG 'vms') ---
resource "azurerm_cosmosdb_sql_database" "db" {
  name                = "campusgate"
  resource_group_name = data.azurerm_resource_group.rg_cosmos.name
  account_name        = data.azurerm_cosmosdb_account.cosmos.name
}

resource "azurerm_cosmosdb_sql_container" "visitors" {
  name                = "visitors"
  resource_group_name = data.azurerm_resource_group.rg_cosmos.name
  account_name        = data.azurerm_cosmosdb_account.cosmos.name
  database_name       = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths = ["/id"] # matches your server.js
}

# --- 3) App Insights (put with your app infra; choose storage RG) ---
resource "azurerm_application_insights" "appi" {
  name                = var.ai_name
  location            = data.azurerm_resource_group.rg_storage.location
  resource_group_name = data.azurerm_resource_group.rg_storage.name
  application_type    = "web"
  workspace_id        ="/subscriptions/609da963-fff4-4437-9369-f351938e5788/resourceGroups/ai_campusgate-ai_0ef43896-74bb-4b84-be94-8aa87f17516b_managed/providers/Microsoft.OperationalInsights/workspaces/managed-campusgate-ai-ws"
  lifecycle {
    ignore_changes = [workspace_id]
  }

  tags = local.tags
}

# --- 4) Key Vault (optional, also in storage RG) ---
data "azurerm_client_config" "me" {}

resource "azurerm_key_vault" "kv" {
  name                       = var.kv_name
  location                   = data.azurerm_resource_group.rg_storage.location
  resource_group_name        = data.azurerm_resource_group.rg_storage.name
  tenant_id                  = data.azurerm_client_config.me.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  access_policy {
    tenant_id          = data.azurerm_client_config.me.tenant_id
    object_id          = data.azurerm_client_config.me.object_id
    secret_permissions = ["Get", "Set", "List", "Delete", "Purge", "Recover"]
  }

  tags = local.tags
}

# --- 5) Function plan + Function App (keep with storage RG for simplicity) ---
resource "azurerm_service_plan" "plan" {
  name                = var.plan_name
  location            = data.azurerm_resource_group.rg_storage.location
  resource_group_name = data.azurerm_resource_group.rg_storage.name
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption
  tags                = local.tags
}

resource "azurerm_linux_function_app" "func" {
  name                = var.func_name
  location            = data.azurerm_resource_group.rg_storage.location
  resource_group_name = data.azurerm_resource_group.rg_storage.name

  service_plan_id            = azurerm_service_plan.plan.id
  storage_account_name       = data.azurerm_storage_account.st.name
  storage_account_access_key = data.azurerm_storage_account.st.primary_access_key

  functions_extension_version = "~4"
  https_only                  = true

  identity { type = "SystemAssigned" }

  site_config {
    application_stack { node_version = "20" }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"              = "node"
    "AzureWebJobsStorage"                   = data.azurerm_storage_account.st.primary_connection_string
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.appi.connection_string

    # app expects these:
    "COSMOS_DB_NAME"   = azurerm_cosmosdb_sql_database.db.name
    "COSMOS_CONTAINER" = azurerm_cosmosdb_sql_container.visitors.name
    "BLOB_CONTAINER"   = var.blob_container_passes
  }

  tags = local.tags
}
