import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB, connectUserDB } from "@/lib/db";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                // Check local DB first (employees), then Atlas (company admin)
                let user = null;

                try {
                    const localConn = await connectUserDB();
                    const LocalUser = localConn.models.User ?? localConn.model("User", User.schema);
                    user = await LocalUser.findOne({ email: credentials.email.toLowerCase() });
                } catch (e) {
                    console.warn("[Auth] Local DB lookup failed:", e);
                }

                if (!user) {
                    // Fall back to Atlas for company admin accounts
                    await connectDB();
                    user = await User.findOne({ email: credentials.email.toLowerCase() });
                }

                if (!user) throw new Error("User not found");

                if (!user.emailVerified) {
                    throw new Error("Please verify your email before logging in");
                }

                if (user.role === "employee" && !user.accountVerified) {
                    throw new Error("Your account is pending verification by your company admin. Please contact your admin.");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) throw new Error("Invalid password");

                return {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    company_id: user.company_id,
                    company_name: user.company_name,
                    role: user.role,
                    accountVerified: user.accountVerified,
                };
            },
        }),
    ],

    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.company_id = user.company_id;
                token.company_name = user.company_name;
                token.role = user.role;
                token.accountVerified = user.accountVerified;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.company_id = token.company_id;
                session.user.company_name = token.company_name;
                session.user.role = token.role;
                session.user.accountVerified = token.accountVerified;
            }
            return session;
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
