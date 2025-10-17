# Resource groups
output "rg_storage" { value = data.azurerm_resource_group.rg_storage.name }
output "rg_cosmos" { value = data.azurerm_resource_group.rg_cosmos.name }

# Storage
output "storage_account_name" { value = data.azurerm_storage_account.st.name }
output "blob_container_passes" { value = azurerm_storage_container.passes.name }
output "queue_visitor_pass_requests" { value = azurerm_storage_queue.pass_requests.name }

# Cosmos
output "cosmos_account_name" { value = data.azurerm_cosmosdb_account.cosmos.name }
output "cosmos_sql_db_name" { value = azurerm_cosmosdb_sql_database.db.name }
output "cosmos_sql_container" { value = azurerm_cosmosdb_sql_container.visitors.name }

# App infra
output "app_insights_name" { value = azurerm_application_insights.appi.name }
output "function_app_name" { value = azurerm_linux_function_app.func.name }
output "function_app_default_hostname" { value = azurerm_linux_function_app.func.default_hostname }
