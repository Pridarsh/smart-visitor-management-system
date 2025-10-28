// Queue message is base64 JSON: { id, email }
const QRCode = require("qrcode");
const { BlobServiceClient } = require("@azure/storage-blob");
const { EmailClient } = require("@azure/communication-email");

module.exports = async function (context, myQueueItem) {
  try {
    const raw = Buffer.from(myQueueItem, "base64").toString("utf8");
    const { id, email } = JSON.parse(raw);
    context.log("PassEmail processing:", id, email);

    // 1) Generate QR with the visitor id (you can embed a check-in URL later)
    const payload = JSON.stringify({ id });
    const png = await QRCode.toBuffer(payload, { width: 320 });

    // 2) Upload QR to Blob (public read)
    const blobConn = process.env.AZURE_STORAGE_CONN;
    const blobService = BlobServiceClient.fromConnectionString(blobConn);
    const container = blobService.getContainerClient("passes");
    await container.createIfNotExists({ access: "blob" });
    const blob = container.getBlockBlobClient(`${id}.png`);
    await blob.uploadData(png, { blobHTTPHeaders: { blobContentType: "image/png" } });
    const qrUrl = blob.url;

    // 3) Send email via Azure Communication Services
    const emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING);
    const sender = process.env.ACS_SENDER; // e.g. "DoNotReply@xxxx.azurecomm.net"

    const html = `
      <p>Hello,</p>
      <p>Your visitor pass <b>${id}</b> is ready. Please show this QR code at the gate.</p>
      <p><img src="${qrUrl}" alt="QR" width="240"/></p>
      <p>Thanks,<br/>CampusGate</p>
    `;

    const resp = await emailClient.send({
      senderAddress: sender,
      recipients: { to: [{ address: email }] },
      content: { subject: `Your visitor pass ${id}`, html }
    });

    context.log("Email queued:", resp?.messageId || resp);
  } catch (err) {
    context.log.error("PassEmail error:", err);
    throw err;
  }
};
