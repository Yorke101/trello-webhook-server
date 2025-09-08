const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// 🔐 Environment variables
const appId = process.env.MC_APP_ID;
const appKey = process.env.MC_APP_KEY;
const accessKey = process.env.MC_ACCESS_KEY;
const secretKey = process.env.MC_SECRET_KEY;

// 🧠 Header generator
function generateHeaders(method, uri) {
  const date = new Date().toUTCString();
  const reqId = uuidv4();
  const stringToSign = `${date}:${reqId}:${method}:${uri}`;
  const signature = crypto.createHmac("sha1", appKey).update(stringToSign).digest("base64");

  console.log("🧾 String to sign:", stringToSign);
  console.log("🔐 Signature:", signature);

  return {
    "Authorization": `MC ${appId}:${signature}`,
    "x-mc-date": date,
    "x-mc-req-id": reqId,
    "x-mc-app-id": appId,
    "Content-Type": "application/json"
  };
}

// 🚀 Main email sender
module.exports = async function sendMimecastEmail({ to, subject, body }) {
  const headers = generateHeaders("POST", "/api/email/send-email");

  const payload = {
    data: [
      {
        to: [{
          emailAddress: "dylany@atkv.org.za",
          displayableName: "Trello Notification"
        }],
        from: {
          emailAddress: "noreply@kommunikasie.atkv.org.za", // must be permitted
          displayableName: "ATKV Trello Bot"
        },
        subject: subject,
        htmlBody: {
          content: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="color: #0055a5;">Trello Update</h2>
              <p><strong>Card:</strong> ${subject}</p>
              <p><strong>Details:</strong></p>
              <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px;">${body}</pre>
              <p style="margin-top: 20px;">Sent via ATKV Trello Automation</p>
            </div>
          `
        },
        plainBody: {
          content: body
        }
      }
    ]
  };

  try {
    const response = await axios.post(
      "https://za-api.mimecast.com/api/email/send-email",
      payload,
      { headers }
    );

    console.log("✅ Mimecast response status:", response.data.meta?.status);

    if (response.data.fail?.length) {
      console.error("❌ Mimecast delivery failed:");
      response.data.fail.forEach((failItem, index) => {
        console.log(`Fail #${index + 1}:`);
        console.log("Key:", JSON.stringify(failItem.key, null, 2));
        console.log("Errors:", JSON.stringify(failItem.errors, null, 2));
      });
    } else {
      console.log("🎉 Email accepted by Mimecast with no delivery errors");
    }
  } catch (error) {
    console.error("❌ Mimecast error:", error.response?.data || error.message);
  }
};
