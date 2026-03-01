import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getEmailLanguage } from "@/lib/email/config";
import { resolveSubject } from "@/lib/email/translations";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const locale = await getEmailLanguage();
      await sendEmail({
        to: user.email,
        subject: resolveSubject(locale, "welcome"),
        template: WelcomeEmail({
          userName: user.name,
          resetUrl: url,
          locale,
        }),
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Session = typeof auth.$Infer.Session;
