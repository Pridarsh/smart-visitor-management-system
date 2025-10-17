import { QueueClient } from "@azure/storage-queue";

const conn = process.env.AZURE_STORAGE_CONN; // same as functions
const queueName = process.env.PASS_REQUESTS_QUEUE || "visitor-pass-requests";

let client = null;
function getClient() {
  if (!client) {
    client = new QueueClient(conn, queueName);
  }
  return client;
}

export async function enqueuePassRequest({ id, email }) {
  const q = getClient();
  await q.createIfNotExists();
  // queue messages are base64-encoded by SDK; stringify first
  const body = JSON.stringify({ id, email });
  await q.sendMessage(Buffer.from(body).toString("base64"));
}
