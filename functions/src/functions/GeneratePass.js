import { app } from "@azure/functions";
import QRCode from "qrcode";
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { EmailClient } from "@azure/communication-email";
import { CosmosClient } from "@azure/cosmos";

export async function GeneratePass(myQueueItem, context) {
  context.log("GeneratePass triggered with:", myQueueItem);

  try {
    function normalizeMsg(input) {
      if (input && typeof input === "object") return input;
      if (typeof input === "string") {
        // First, try normal JSON
        try { return JSON.parse(input); } catch {}
        // Try to coerce common portal input: single quotes & unquoted keys
        try {
          const fixed = input
            .replace(/'/g, '"')                              // ' → "
            .replace(/([{,\s])(\w+)\s*:/g, '$1"$2":');       // id: → "id":
          return JSON.parse(fixed);
        } catch {
          throw new Error(
            'Invalid queue payload. Expect JSON like {"id":"...","email":"..."}'
          );
        }
      }
      throw new Error("Unsupported queue payload type");
    }
    
    const msg = normalizeMsg(myQueueItem);
    
    const visitorId = msg?.id;
    const email = msg?.email;
    if (!visitorId || !email) throw new Error("Queue message must include { id, email }");

    // 1) QR buffer
    const png = await QRCode.toBuffer(visitorId, { width: 400, margin: 2 });

    // 2) Upload to Blob
    const blobConn = process.env.AZURE_STORAGE_CONN;
    const blobContainerName = process.env.BLOB_CONTAINER || "passes";
    const blobSvc = BlobServiceClient.fromConnectionString(blobConn);
    const container = blobSvc.getContainerClient(blobContainerName);
    await container.createIfNotExists();


    const blobName = `${visitorId}.png`;
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.uploadData(png, { blobHTTPHeaders: { blobContentType: "image/png" } });
    context.log("Uploaded blob:", blockBlob.url);

    // 3) SAS URL (24h)
    let qrUrl = blockBlob.url;
    const match = blobConn.match(/AccountName=([^;]+).*AccountKey=([^;]+)/i);
    if (match) {
      const accountName = match[1];
      const accountKey = match[2];
      const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);
      const startsOn = new Date();
      const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sas = generateBlobSASQueryParameters(
        {
          containerName: container.containerName,
          blobName,
          permissions: BlobSASPermissions.parse("r"),
          startsOn,
          expiresOn,
          protocol: SASProtocol.Https,
        },
        sharedKey
      ).toString();
      qrUrl = `${blockBlob.url}?${sas}`;
    }
    context.log("SAS URL:", qrUrl);

    // 4) Update Cosmos with qrUrl (best-effort)
    try {
      if (process.env.COSMOS_DB_CONN) {
        const cosmos = new CosmosClient(process.env.COSMOS_DB_CONN);
        const db = cosmos.database(process.env.COSMOS_DB_NAME || "campusgate");
        const cont = db.container(process.env.COSMOS_CONTAINER || "visitors");
        const pk = visitorId; // using id for /id or /partitionKey

        try {
          await cont.item(visitorId, pk).patch([{ op: "add", path: "/qrUrl", value: qrUrl }]);
        } catch {
          const { resource: doc } = await cont.item(visitorId, pk).read();
          doc.qrUrl = qrUrl;
          await cont.items.upsert(doc);
        }
        context.log("Cosmos updated for", visitorId);
      } else {
        context.warn("COSMOS_DB_CONN not set; skipping Cosmos update.");
      }
    } catch (cosmosErr) {
      context.warn("Cosmos update failed:", cosmosErr?.message || cosmosErr);
      // do not throw; QR is generated & uploaded already
    }

    // 5) Send email (best-effort, do not poison the message if email fails)
    try {
      const from = process.env.ACS_SENDER;
      const acsConn = process.env.ACS_CONNECTION_STRING;
      if (acsConn && from) {
        const emailClient = new EmailClient(acsConn);
           const message = {
             senderAddress: from,
             recipients: { to: [{ address: email }] },
             content: {
               subject: `Your CampusGate Pass (${visitorId})`,
               html: `<p>Show this QR at the gate.</p>
                      <p>Visitor ID: <b>${visitorId}</b></p>
                      <p><img src="${qrUrl}" alt="QR" /></p>`,
             },
           };
           const poller = await emailClient.beginSend(message);
           await poller.pollUntilDone();
           context.log("Email sent to", email);
          
        context.log("Email sent to", email);
      } else {
        context.warn("ACS not configured; skipping email.");
      }
    } catch (mailErr) {
      context.warn("Email send failed:", mailErr?.message || mailErr);
      // don't throw — avoid poison queue if only email failed
    }
  } catch (err) {
    context.error("GeneratePass failed:", err?.message || err);
    throw err; // real failure (e.g., storage auth), allow retry
  }
}

app.storageQueue("GeneratePass", {
  queueName: "visitor-pass-requests",
  connection: "AZURE_STORAGE_CONN",
  handler: GeneratePass,
});
