import { CosmosClient } from "@azure/cosmos";

const { COSMOS_DB_CONN, COSMOS_DB_NAME = "campusgate", COSMOS_CONTAINER = "visitors" } = process.env;

let container = null;
export function getContainer() {
  if (!container) {
    const client = new CosmosClient(COSMOS_DB_CONN);
    const db = client.database(COSMOS_DB_NAME);
    container = db.container(COSMOS_CONTAINER);
  }
  return container;
}

export async function upsertVisitor(doc) {
  const c = getContainer();
  const { resource } = await c.items.upsert(doc);
  return resource;
}
export async function queryVisitors(limit = 50) {
  const c = getContainer();
  const query = {
    query: "SELECT TOP @limit * FROM c ORDER BY c._ts DESC",
    parameters: [{ name: "@limit", value: limit }]
  };
  const { resources } = await c.items.query(query).fetchAll();
  return resources;
}
