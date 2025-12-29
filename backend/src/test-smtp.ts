// Script temporal para probar conexión SMTP
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../config/.env") });

const host = process.env.SMTP_HOST || "mail.nextstepslab.com";
const port = parseInt(process.env.SMTP_PORT || "465", 10);
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";

console.log("Testing SMTP connection...");
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`User: ${user}`);
console.log(`Pass: ${pass ? "***" : "NOT SET"}`);

if (!user || !pass) {
  console.error("ERROR: SMTP_USER or SMTP_PASS not set!");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  debug: true,
  logger: true,
});

console.log("\nAttempting to verify SMTP connection...");

transporter.verify((error: any, success) => {
  if (error) {
    console.error("❌ SMTP connection failed:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("SMTP response:", error.response);
    }
    if (error.responseCode) {
      console.error("Response code:", error.responseCode);
    }
    process.exit(1);
  } else {
    console.log("✅ SMTP connection successful!");
    console.log("Server is ready to send emails");

    // Opcional: intentar enviar un email de prueba
    console.log("\nAttempting to send test email...");
    transporter.sendMail(
      {
        from: user,
        to: user, // Enviar a sí mismo para prueba
        subject: "Test email from Habitus SMTP",
        text: "This is a test email to verify SMTP configuration.",
        html: "<p>This is a test email to verify SMTP configuration.</p>",
      },
      (err, info) => {
        if (err) {
          console.error("❌ Failed to send test email:");
          console.error(err);
          process.exit(1);
        } else {
          console.log("✅ Test email sent successfully!");
          console.log("Message ID:", info.messageId);
          console.log("Response:", info.response);
          process.exit(0);
        }
      }
    );
  }
});
