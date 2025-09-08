const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// 🔐 Your credentials
const appId = "d8aa7532-81ca-4eef-88f8-7949a4d8268e";
const appKey = "3cf1d88b-9f46-4782-aea0-b4c55ae15425";
const accessKey = "mYtOL3XZCOwG96BOiFTZRm-vnzZRkTDGmbL9EMJGFnMnka4VASVMXeDM3oGIICpKvCeUROktmg0m_iDASi13FtPCNO3jANVLWkdr6_iydeltFmUHD2VjwzTHRfeOKs4eduHgrJjpvilcF3FNNLG7pQ";
const secretKey = "/GWVWrxBZNGM/FxHr/UGvEzZIVgplgLOMiRkAk6lYY5Si6dC3EjpPDhnrR8pC7vk9vNpvR9abJeSPVJ+tpcBUQ==";

// 🕒 Generate headers
function generateHeaders(method, uri) {
  const date = new Date().toUTCString();
  const reqId = uuidv4();
  const stringToSign = `${date}:${reqId}:${method}:${uri}`;
  const signature = crypto.createHmac("sha1", appKey).update(stringToSign).digest("base64");

  return {
    "Authorization": `MC ${appId}:${signature}`,
    "x-mc-date": date,
    "x-mc-req-id": reqId,
    "x-mc-app-id": appId,
    "x-mc-access-key": accessKey,
    "x-mc-secret-key": secretKey,
    "Content-Type": "application/json"
  };
}

// 📬 Email sender
module.exports = async function sendEmail({ to, subject, body }) {
  const headers = generateHeaders("POST", "/api/email/send-email");

  const payload = {
    data: [
      {
        to: [{ emailAddress: to, displayableName: "Trello Notification" }],
        from: {
          emailAddress: "davidk@atkv.org.za@", // must be permitted by Mimecast
          displayableName: "Trello Bot"
        },
        subject: subject,
        plainBody: { content: body }
      }
    ]
  };

  try {
    const response = await axios.post("https://za-api.mimecast.com/api/email/send-email", payload, { headers });
    console.log("✅ Email sent:", response.data);
  } catch (error) {
    console.error("❌ Error sending email:", error.response?.data || error.message);
  }
};
