import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { connectDB, connectUserDB } from "@/lib/db";
import mongoose from "mongoose";
import User, { IUser } from "@/models/User";
import { sendVerificationEmail } from "@/lib/email";

interface SignupBody {
    name: string;
    email: string;
    password: string;
    company_id: string;
    company_name: string;
    role?: "admin" | "employee";
}

export async function POST(req: Request) {
    try {
        const body: SignupBody = await req.json();
        const { name, email, password, company_id, company_name, role } = body;

        if (!name || !email || !password || !company_id || !company_name) {
            return NextResponse.json({ message: "All fields are required" }, { status: 400 });
        }

        // Company admins are stored in Atlas; employees in local DB
        const isAdmin = role === "admin";
        let UserModel: mongoose.Model<IUser>;

        if (isAdmin) {
            await connectDB();
            UserModel = User;
        } else {
            const localConn = await connectUserDB();
            UserModel = localConn.models.User as mongoose.Model<IUser>
              ?? localConn.model<IUser>("User", User.schema);
        }

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: "User already exists" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const hashedVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");

        await UserModel.create({
            name,
            email,
            password: hashedPassword,
            company_id,
            company_name,
            role: role || "employee",
            accountVerified: role === "admin",
            emailVerificationToken: hashedVerificationToken,
            emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const emailResult = await sendVerificationEmail(email, verificationToken);
        if (!emailResult.success) {
            console.error("Failed to send verification email:", emailResult.error);
        }

        return NextResponse.json(
            { message: "User registered successfully. Please check your email to verify your account." },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Signup failed" },
            { status: 500 }
        );
    }
}
