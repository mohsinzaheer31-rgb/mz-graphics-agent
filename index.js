const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// =============================================
// MZ GRAPHICS - WhatsApp AI Agent
// WhatsApp: +923246582405
// =============================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mzgraphics2024";

// Conversation history store (in-memory)
const conversations = {};

const SYSTEM_PROMPT = `Tu MZ GRAPHICS ka official WhatsApp AI customer service agent hai.

Business: MZ GRAPHICS — Professional Graphic Design Studio
WhatsApp: +923246582405
Timing: 9am se 9pm (Pakistan Standard Time)
Location: Pakistan

SERVICES AUR PRICES:
- Visiting Card Design: Rs. 500 - 1,500
- Logo Design: Rs. 2,000 - 8,000 (complexity ke mutabiq)
- Flex Banner Design: Rs. 800 - 2,500 (size ke mutabiq)
- Brochure Design: Rs. 1,500 - 4,000 (pages ke mutabiq)
- Standee Design: Rs. 1,500 - 3,000
- Box Design: Rs. 2,000 - 6,000

DELIVERY: Digital files 1-3 working din mein
REVISIONS: Har order mein 2 free revisions
PAYMENT: Easypaisa / JazzCash / Bank Transfer

AGENT KE RULES:
1. Hamesha Roman Urdu ya Urdu mein baat karo
2. MZ GRAPHICS ka naam proudly use karo
3. Customer se zaroor poochho: size, colors, text/content, deadline
4. Short friendly replies do — 4-5 lines max
5. Emojis use karo lekin zyada nahi
6. Price range batao: "Rs. 1,500 se 2,500 tak"
7. Order confirm par: "Shukriya! Kaam shuru kerta hoon, [time] mein ready hoga"
8. Mushkil sawal par: "Main owner se pooch kar bata deta hoon"
9. Raat 9pm ke baad: "Hamari timing 9am-9pm hai, kal jawab denge InshaAllah"`;

// =============================================
// WEBHOOK VERIFICATION (Meta ke liye)
// =============================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// =============================================
// INCOMING MESSAGE HANDLER
// =============================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Foran 200 do Meta ko

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from; // Customer ka number
    const msgType = message.type;

    let userText = "";
    if (msgType === "text") {
      userText = message.text.body;
    } else if (msgType === "image") {
      userText = "Customer ne ek image bheja hai design reference ke liye.";
    } else {
      userText = "Customer ne koi media bheja hai.";
    }

    console.log(`Message from ${from}: ${userText}`);

    // Conversation history maintain karo
    if (!conversations[from]) {
      conversations[from] = [];
    }
    conversations[from].push({ role: "user", content: userText });

    // Last 10 messages rakho memory mein
    if (conversations[from].length > 20) {
      conversations[from] = conversations[from].slice(-20);
    }

    // Claude AI se reply lo
    const aiReply = await getClaudeReply(conversations[from]);
    conversations[from].push({ role: "assistant", content: aiReply });

    // WhatsApp par bhejo
    await sendWhatsAppMessage(from, aiReply, value.metadata.phone_number_id);

  } catch (error) {
    console.error("Error:", error.message);
  }
});

// =============================================
// CLAUDE AI REPLY FUNCTION
// =============================================
async function getClaudeReply(history) {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: history,
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.content[0].text;
  } catch (error) {
    console.error("Claude API error:", error.message);
    return "Maafi! Thodi technical problem hai. Seedha call karein: +923246582405 🙏";
  }
}

// =============================================
// WHATSAPP MESSAGE SEND FUNCTION
// =============================================
async function sendWhatsAppMessage(to, text, phoneNumberId) {
  const token = process.env.WHATSAPP_TOKEN;
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`Message sent to ${to}`);
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
  }
}

// =============================================
// SERVER START
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MZ GRAPHICS AI Agent running on port ${PORT}`);
});
