terraform {
  required_version = ">= 1.3.0"

  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      # Use a recent 3.x version that you already have installed;
      # you can loosen this to "~> 3.0" if you prefer.
      version = "~> 3.114"
    }
  }
}

provider "azurerm" {
  features {}
}
