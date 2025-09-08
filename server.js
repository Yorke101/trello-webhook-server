const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const sendMimecastEmail = require("./sendMimecastEmail");

const app = express();
app.use(bodyParser.json());

// ✅ Trello HEAD validation
app.head("/trello-webhook", (req, res) => {
  console.log("Received Trello HEAD validation");
  res.status(200).send();
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("Server is alive");
});

// ✅ Webhook handler
app.post("/trello-webhook", async (req, res) => {
  console.log("Webhook received");

  const action = req.body.action;

  if (
    action?.type !== "updateCard" ||
    !action?.data?.listBefore ||
    !action?.data?.listAfter
  ) {
    console.log("Ignoring non-list movement event");
    return res.status(200).send("OK");
  }

  let card = action?.data?.card;

  if (!card?.id) {
    console.log("No card data found.");
    return res.status(200).send("OK");
  }

  try {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const response = await axios.get(`https://api.trello.com/1/cards/${card.id}?key=${key}&token=${token}`);
    card = response.data;
  } catch (err) {
    console.error("Failed to fetch full card data:", err.message);
    return res.status(200).send("OK");
  }

  const cardName = card.name;
  const cardUrl = `https://trello.com/c/${card.shortLink}`;
  const dueDate = card.due
    ? new Date(card.due).toLocaleString("en-ZA", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "No due date";

  const listBeforeRaw = action.data.listBefore.name || "Unknown";
  const listAfterRaw = action.data.listAfter.name || "Unknown";
  const listBefore = listBeforeRaw.trim().toLowerCase();
  const listAfter = listAfterRaw.trim().toLowerCase();

  console.log(`Card "${cardName}" moved from "${listBeforeRaw}" to "${listAfterRaw}"`);

  let members = "No members assigned";
  if (card.idMembers?.length) {
    const memberNames = await getMemberNames(card.idMembers);
    members = memberNames.length ? memberNames.join(", ") : members;
  }

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
      : " — work in progress 🛠";
  } else if (listAfter === "archived") {
    customMessage += listBefore === "completed"
      ? " — archived after completion 🗃️"
      : " — archived 🗃️";
  } else if (listBefore === "archived" && listAfter === "completed") {
    customMessage += " — restored from archive 🔄";
  } else {
    customMessage += " — status updated 📌";
  }

  await sendEmailNotification(cardName, listBeforeRaw, listAfterRaw, customMessage, cardUrl, dueDate, members);

  res.status(200).send("OK");
});

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

async function sendEmailNotification(cardName, listBefore, listAfter, customMessage, cardUrl, dueDate, members) {
  console.log("Preparing to send Mimecast email...");

  const body = `
Card: ${cardName}
Moved from: ${listBefore}
Moved to: ${listAfter}
Due Date: ${dueDate}
Members: ${members}

${customMessage}
Link: ${cardUrl}
`;

  await sendMimecastEmail({
    to: process.env.EMAIL_TO,
    subject: `Trello Update: ${cardName}`,
    body
  });
}

function triggerOnboardingFlow(cardName) {
  console.log(`(Mock) Triggering onboarding for "${cardName}"`);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
