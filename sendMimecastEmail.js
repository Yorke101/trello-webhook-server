const axios = require("axios");

// 🚀 Main email sender (no Mimecast auth headers)
module.exports = async function sendMimecastEmail({ to, subject, body }) {
  try {
    console.log("📬 sendMimecastEmail function triggered");

    // 🕒 Server time
    const date = new Date().toUTCString();
    console.log("🕒 Server time:", date);

    // Only basic headers!
    const headers = {
      "Content-Type": "application/json",
      "Accept": "*/*"
    };

    const payload = {
      data: [
        {
          to: [{
            emailAddress: to,
            displayableName: "Trello Notification"
          }],
          from: {
            emailAddress: "noreply@kommunikasie.atkv.org.za", // must be delegated
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
          }
        }
      ]
    };

    console.log("📤 Attempting to send email to:", to);
    console.log("📦 Headers sent:", JSON.stringify(headers, null, 2));
    console.log("📨 Payload sent:", JSON.stringify(payload, null, 2));

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
  } catch (err) {
    console.error("🔥 Top-level error caught:", err.message);
  }
};