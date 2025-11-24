// server/utils/email.js
import nodemailer from "nodemailer";
import pug from "pug";
import { htmlToText } from "html-to-text";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import AppError from "./appError.js";
import { logger } from "../middleware/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Email {
  constructor(user, url, data = {}) {
    this.to = user.email;
    this.firstName = user.name?.split(" ")[0] || "User";
    this.url = url;
    this.from = process.env.EMAIL_USERNAME 
      ? `Ayaan from GameShop <${process.env.EMAIL_USERNAME}>`
      : process.env.EMAIL_FROM || "noreply@gameshop.com";
    this.data = data;
  }

  /**
   * Create a secure transport for sending emails.
   */
  newTransport() {
    const { EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_HOST, EMAIL_PORT, NODE_ENV } =
      process.env;

    // In development, allow email to be optional (log instead of sending)
    if (NODE_ENV === "development" && (!EMAIL_USERNAME || !EMAIL_PASSWORD)) {
      logger.warn("Email not configured - emails will not be sent in development", {
        hasUsername: !!EMAIL_USERNAME,
        hasPassword: !!EMAIL_PASSWORD,
      });
      // Return a mock transport that logs instead of sending
      return {
        sendMail: async (options) => {
          logger.info("📧 [DEV MODE] Email would be sent", {
            to: options.to,
            subject: options.subject,
            from: options.from,
          });
          return { messageId: "dev-mode-mock-id" };
        },
      };
    }

    if (!EMAIL_USERNAME || !EMAIL_PASSWORD) {
      logger.error("Email transport misconfigured: missing credentials", {
        hasUsername: !!EMAIL_USERNAME,
        hasPassword: !!EMAIL_PASSWORD,
        nodeEnv: NODE_ENV,
      });
      throw new AppError(
        "Email service is not configured correctly. Please set EMAIL_USERNAME and EMAIL_PASSWORD environment variables.",
        500
      );
    }

    const host = EMAIL_HOST || "smtp.gmail.com";
    const port = Number(EMAIL_PORT) || 465; // 465 with secure: true

    try {
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user: EMAIL_USERNAME,
          pass: EMAIL_PASSWORD,
        },
        // Connection timeout
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    } catch (transportError) {
      logger.error("Failed to create email transport", {
        error: transportError.message,
        host,
        port,
      });
      throw new AppError(
        `Failed to configure email transport: ${transportError.message}`,
        500
      );
    }
  }

  async send(template, subject) {
    try {
      const templatePath = path.join(
        __dirname,
        `../views/email/${template}.pug`
      );

      // Check if template file exists
      if (!fs.existsSync(templatePath)) {
        logger.error("Email template not found", { templatePath, template });
        throw new AppError(
          `Email template '${template}' not found`,
          500,
          { templatePath }
        );
      }

      // Render HTML based on pug template
      let html;
      try {
        html = pug.renderFile(templatePath, {
          firstName: this.firstName,
          url: this.url,
          subject,
          ...this.data,
        });
      } catch (renderError) {
        logger.error("Email template rendering failed", {
          error: renderError.message,
          template,
          templatePath,
        });
        throw new AppError(
          `Failed to render email template: ${renderError.message}`,
          500,
          { template, originalError: renderError.message }
        );
      }

      const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: htmlToText(html, {
          wordwrap: 130,
          ignoreImage: true,
        }),
        priority: "high",
      };

      // Create transport and send
      const transport = this.newTransport();
      
      try {
        await transport.sendMail(mailOptions);
      } catch (sendError) {
        logger.error("Nodemailer send failed", {
          error: sendError.message,
          code: sendError.code,
          command: sendError.command,
          response: sendError.response,
          to: this.to,
        });
        
        // Provide more specific error messages
        let errorMessage = "Failed to send email";
        if (sendError.code === "EAUTH") {
          errorMessage = "Email authentication failed. Please check EMAIL_USERNAME and EMAIL_PASSWORD.";
        } else if (sendError.code === "ECONNECTION") {
          errorMessage = `Cannot connect to email server (${process.env.EMAIL_HOST || "smtp.gmail.com"})`;
        } else if (sendError.code === "ETIMEDOUT") {
          errorMessage = "Email server connection timed out";
        } else if (sendError.response) {
          errorMessage = `Email server error: ${sendError.response}`;
        }
        
        throw new AppError(errorMessage, 500, {
          template,
          recipient: this.to,
          errorCode: sendError.code,
          originalError: sendError.message,
        });
      }

      logger.info("Email sent successfully", {
        to: this.to,
        subject,
        template,
      });
    } catch (err) {
      // Re-throw AppError as-is
      if (err instanceof AppError) {
        throw err;
      }
      
      // Wrap other errors
      logger.error("Email send failed (unexpected error)", {
        message: err.message,
        stack: err.stack,
        to: this.to,
        subject,
        template,
      });
      throw new AppError(
        `Error sending email: ${err.message}`,
        500,
        {
          template,
          recipient: this.to,
          originalError: err.message,
        }
      );
    }
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to the GameShop Family!");
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Your password reset token (valid for only 10 minutes)"
    );
  }

  async sendOrderConfirmation(order) {
    const orderId = order.id || order._id || order.order_number || "N/A";
    await this.send("orderConfirmation", `Your GameShop Order #${orderId}`, {
      order,
    });
  }

  async sendVerificationEmail() {
    await this.send("emailVerification", "Verify your GameShop account email");
  }
}
