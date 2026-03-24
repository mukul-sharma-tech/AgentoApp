import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectUserDB } from "@/lib/db";
import ChatSession from "@/models/ChatSession";

async function getChatSessionModel() {
  const conn = await connectUserDB();
  return conn.models.ChatSession ?? conn.model("ChatSession", ChatSession.schema);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const ChatSessionModel = await getChatSessionModel();
    const chatSession = await ChatSessionModel.findOne({
      _id: id,
      company_id: session.user.company_id,
      user_email: session.user.email,
    });

    if (!chatSession) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ session: chatSession });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { userMessage, assistantMessage, mermaidCode, citations } = await req.json();

    const ChatSessionModel = await getChatSessionModel();
    const chatSession = await ChatSessionModel.findOne({
      _id: id,
      company_id: session.user.company_id,
      user_email: session.user.email,
    });

    if (!chatSession) return NextResponse.json({ message: "Not found" }, { status: 404 });

    if (chatSession.messages.length === 0 && userMessage) {
      chatSession.title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : "");
    }

    chatSession.messages.push({ role: "user", content: userMessage, createdAt: new Date() });
    chatSession.messages.push({
      role: "assistant", content: assistantMessage,
      ...(mermaidCode && { mermaidCode }),
      ...(citations?.length && { citations }),
      createdAt: new Date(),
    });

    await chatSession.save();
    return NextResponse.json({ session: chatSession });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const ChatSessionModel = await getChatSessionModel();
    await ChatSessionModel.deleteOne({
      _id: id,
      company_id: session.user.company_id,
      user_email: session.user.email,
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}
