// backend/services/queue.js
import { QueueClient } from "@azure/storage-queue";

const conn = process.env.AZURE_STORAGE_CONN; // Storage connection string
const queueName = process.env.PASS_REQUESTS_QUEUE || "visitor-pass-requests";

let client;
function getClient() {
  if (!conn) {
    throw new Error("AZURE_STORAGE_CONN is not set");
  }
  if (!queueName) {
    throw new Error("PASS_REQUESTS_QUEUE is not set");
  }

  if (!client) {
    console.log("Creating QueueClient with queue:", queueName);
    client = new QueueClient(conn, queueName);
  }
  return client;
}

export async function enqueuePassRequest({ id, email }) {
  const q = getClient();
  await q.createIfNotExists();
  const body = JSON.stringify({ id, email });
  await q.sendMessage(Buffer.from(body).toString("base64"));
}
