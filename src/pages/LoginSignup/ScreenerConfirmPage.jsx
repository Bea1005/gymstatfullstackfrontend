import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_URL = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/+$/, "");

export default function ScreenerConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | already | expired | invalid | error
  const [message, setMessage] = useState("");
  const [screenerName, setScreenerName] = useState("");

  useEffect(() => {
    const token = searchParams.get("token") || "";
    if (!token) { setStatus("invalid"); setMessage("No authorization token was found in this link."); return; }

    const confirm = async () => {
      try {
        const res = await fetch(API_URL + "/users/screeners/confirm-authorization?token=" + encodeURIComponent(token));
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setScreenerName(data.screener && data.screener.fullname ? data.screener.fullname : "");
          setStatus("success");
          setMessage(data.message || "Authorization confirmed. You may now log in.");
        } else if (res.status === 409) {
          setStatus("already");
          setMessage(data.message || "You have already accepted this authorization.");
        } else if (res.status === 410) {
          setStatus("expired");
          setMessage(data.message || "This authorization link has expired.");
        } else {
          setStatus("invalid");
          setMessage(data.message || "This authorization link is invalid or has already been used.");
        }
      } catch {
        setStatus("error");
        setMessage("Unable to connect to the server. Please check your connection and try again.");
      }
    };
    confirm();
  }, [searchParams]);

  const isSuccess = status === "success" || status === "already";
  const iconColor = isSuccess ? "#2e7d32" : status === "loading" ? "#7a0a0a" : "#b71c1c";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", padding: "24px" }}>
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", maxWidth: 480, width: "100%", padding: "40px 36px", textAlign: "center" }}>
        <h2 style={{ color: "#7a0a0a", marginBottom: 4, fontSize: 22 }}>GYMSTAT</h2>
        <p style={{ color: "#777", fontSize: 13, marginTop: 0, marginBottom: 28 }}>Marinduque State University</p>

        {status === "loading" && (
          <>
            <div style={{ width: 48, height: 48, border: "4px solid #e0d0c0", borderTopColor: "#7a0a0a", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ color: "#555" }}>Verifying your authorization…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {status !== "loading" && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>
              {isSuccess ? "✅" : status === "expired" ? "⏰" : "❌"}
            </div>
            {screenerName && isSuccess && (
              <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#333" }}>Dear {screenerName},</p>
            )}
            <p style={{ fontSize: 15, color: iconColor, fontWeight: 600, marginBottom: 8 }}>
              {status === "success" && "Authorization Confirmed!"}
              {status === "already" && "Already Confirmed"}
              {status === "expired" && "Link Expired"}
              {(status === "invalid" || status === "error") && "Authorization Failed"}
            </p>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 24 }}>{message}</p>

            {status === "success" && (
              <p style={{ fontSize: 13, color: "#666", background: "#f0faf0", border: "1px solid #c8e6c9", borderRadius: 8, padding: "12px 16px", marginBottom: 24 }}>
                Your account has been activated. You can now log in to GYMSTAT using your registered email and password.
              </p>
            )}

            <button
              onClick={() => navigate("/login")}
              style={{ background: "#7a0a0a", color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
