import { Download, FileText, BookOpen } from "lucide-react";

const files = [
  {
    id: 1,
    reviewNum: "Book Review – 1",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    candidate: "Sudhan KS",
    filename: "BookReview1_ToKillAMockingbird_SudhanKS.pptx",
    color: "#1A5C32",
  },
  {
    id: 2,
    reviewNum: "Book Review – 2",
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    candidate: "Sudhan KS",
    filename: "BookReview2_HarryPotter_SudhanKS.pptx",
    color: "#1A5C32",
  },
];

export default function Downloads() {
  return (
    <div style={{ minHeight: "100vh", background: "#f0f7f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ background: "#1A5C32", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, marginBottom: 16 }}>
            <BookOpen size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1A5C32", margin: "0 0 6px" }}>
            Nehru Arts and Science College
          </h1>
          <p style={{ fontSize: 15, color: "#555", margin: 0 }}>
            Communicative English Practical – II &nbsp;|&nbsp; Book Review Presentations
          </p>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            Candidate: <strong>Sudhan KS</strong>
          </p>
        </div>

        {files.map((f) => (
          <div
            key={f.id}
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1.5px solid #d4e8db",
              padding: "20px 24px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 18,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ background: "#e8f5ec", borderRadius: 10, padding: 14, flexShrink: 0 }}>
              <FileText size={28} color="#1A5C32" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#C8A01A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                {f.reviewNum}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1A5C32", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                by {f.author} &nbsp;·&nbsp; {f.candidate}
              </div>
            </div>

            <a
              href={`/api/download/ppt/${f.filename}`}
              download={f.filename}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#1A5C32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <Download size={16} />
              Download
            </a>
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#999" }}>
          Click Download to save the .pptx file — open in Microsoft PowerPoint or Google Slides
        </div>
      </div>
    </div>
  );
}
