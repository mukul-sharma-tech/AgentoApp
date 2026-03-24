import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectUserDB } from "@/lib/db";
import DocumentModel from "@/models/Document";
import VectorChunkModel from "@/models/VectorChunk";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userConn = await connectUserDB();
    const DocumentModel2 = userConn.models.Document ?? userConn.model("Document", DocumentModel.schema);
    const VectorChunkModel2 = userConn.models.VectorChunk ?? userConn.model("VectorChunk", VectorChunkModel.schema);

    const companyId = session.user.company_id;
    
    const documents = await DocumentModel2.find({ company_id: companyId });
    const vectorChunks = await VectorChunkModel2.find({ "metadata.company_id": companyId });
    const allDocuments = await DocumentModel2.find({});
    const allVectorChunks = await VectorChunkModel2.find({});

    return NextResponse.json({
      session: {
        email: session.user.email,
        company_id: companyId,
        role: session.user.role,
      },
      thisCompany: {
        documentsCount: documents.length,
        vectorChunksCount: vectorChunks.length,
      },
      allDatabase: {
        totalDocuments: allDocuments.length,
        totalVectorChunks: allVectorChunks.length,
        sampleDocument: allDocuments[0] ? {
          company_id: (allDocuments[0] as any).company_id,
          filename: allDocuments[0].filename,
          category: allDocuments[0].category,
        } : null,
        sampleVectorChunk: allVectorChunks[0] ? {
          company_id: allVectorChunks[0].metadata.company_id,
          filename: allVectorChunks[0].metadata.filename,
          textPreview: allVectorChunks[0].textContent.substring(0, 200),
          vectorDimensions: allVectorChunks[0].vectorContent.length,
        } : null,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ message: "Debug failed", error: String(error) }, { status: 500 });
  }
}
