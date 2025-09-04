const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// ✅ Trello HEAD validation
app.head("/trello-webhook", (req, res) => {
  console.log("Received Trello HEAD validation");
  res.status(200).send();
});

// ✅ Basic health check
app.get("/", (req, res) => {
  res.send("Server is alive");
});

// ✅ Trello webhook POST handler
app.post("/trello-webhook", async (req, res) => {
  console.log("Webhook received");
  const action = req.body.action;
  const card = action?.data?.card;

  if (!card || !card.name) {
    console.log("No card data found.");
    return res.status(200).send("OK");
  }

  const cardName = card.name;
  const cardUrl = card.shortLink
    ? `https://trello.com/c/${card.shortLink}`
    : "https://trello.com";
  const listBeforeRaw = action?.data?.listBefore?.name || "Unknown";
  const listAfterRaw = action?.data?.listAfter?.name || "Unknown";
  const listBefore = listBeforeRaw.trim().toLowerCase();
  const listAfter = listAfterRaw.trim().toLowerCase();

  const importantLists = [
    "to do", "in progress", "approval", "completed", "archived"
  ];

  console.log(`Card "${cardName}" moved from "${listBeforeRaw}" to "${listAfterRaw}"`);

  // ✅ Format due date
  let dueDate = "No due date";
  if (card.due) {
    try {
      dueDate = new Date(card.due).toLocaleString("en-ZA", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (err) {
      console.error("Date parsing error:", err.message);
    }
  }

  // ✅ Get member names
  let members = "No members assigned";
  if (card.idMembers?.length) {
    const memberNames = await getMemberNames(card.idMembers);
    members = memberNames.length ? memberNames.join(", ") : members;
  }

  // ✅ Build custom message
  let customMessage = `Card moved from "${listBeforeRaw}" to "${listAfterRaw}"`;

  if (listAfter === "approval") {
    customMessage += listBefore === "completed"
      ? " — reopened for review 🔍"
      : " — ready for review ✔️";
    triggerOnboardingFlow(cardName);
  } else if (listAfter === "to do") {
    customMessage += " — ticket sent back for revision 🔁";
  } else if (listAfter === "completed") {
    customMessage += " — completed 🎉";
  } else if (listAfter === "in progress") {
    customMessage += listBefore === "approval"
      ? " — sent back for rework 🔧"
      : " — work in progress 🚧";
  } else if (listAfter === "archived") {
    customMessage += listBefore === "completed"
      ? " — archived after completion 🗃️"
      : " — archived 🗃️";
  } else if (listBefore === "archived" && listAfter === "completed") {
    customMessage += " — restored from archive 🔄";
  } else {
    customMessage += " — status updated 📌";
  }

  // ✅ Send email
  sendEmailNotification(cardName, listBeforeRaw, listAfterRaw, customMessage, cardUrl, dueDate, members);

  res.status(200).send("OK");
});

// ✅ Fetch Trello member names
async function getMemberNames(idMembers) {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  const namePromises = idMembers.map(id =>
    axios
      .get(`https://api.trello.com/1/members/${id}?key=${key}&token=${token}`)
      .then(res => res.data.fullName)
      .catch(() => `Unknown (${id})`)
  );

  return Promise.all(namePromises);
}

// ✅ Send email notification
function sendEmailNotification(cardName, listBefore, listAfter, customMessage, cardUrl, dueDate, members) {
  console.log("Preparing to send email...");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `Trello Update: ${cardName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #0079BF;">Trello Card Update</h2>
        <p><strong>Card:</strong> <a href="${cardUrl}" target="_blank">${cardName}</a></p>
        <p><strong>Moved from:</strong> ${listBefore}</p>
        <p><strong>Moved to:</strong> ${listAfter}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
        <p><strong>Members:</strong> ${members}</p>
        <p style="margin-top: 20px;">${customMessage}</p>
        <hr>
        <small>This notification was triggered by your Trello webhook automation.</small>
      </div>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Email error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

// ✅ Trigger onboarding flow
function triggerOnboardingFlow(cardName) {
  console.log(`Triggering onboarding for "${cardName}"`);

  axios.post("https://your-onboarding-api.com/start", {
    cardName: cardName,
    source: "Trello",
    timestamp: new Date().toISOString()
  })
  .then(response => {
    console.log("Onboarding triggered:", response.data);
  })
  .catch(error => {
    console.error("Onboarding error:", error.message);
  });
}

// ✅ Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
