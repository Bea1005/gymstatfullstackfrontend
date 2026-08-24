import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../services/api";
import "./StudentPortal.css";

const UPDATES = [
  { id: 1, title: "Team 1 Basketball Team Training", date: "January 23, 2026", time: "8AM�10AM", type: "training" },
  { id: 2, title: "Intramural Requirements 2026", date: "January 14, 2026", time: "All Day", type: "requirement" },
];

export default function StudentHomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: "", email: "" });
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "student") {
      alert("Unauthorized access. Please login.");
      navigate("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser({
        name: userData.fullname || userData.name || "Athlete",
        email: userData.email || "student@marsu.edu"
      });
    } else {
      setUser({ name: "Athlete", email: "student@marsu.edu" });
    }

    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const announcementsData = await api.getAnnouncements({ limit: 5 });
      setAnnouncements(announcementsData.data || []);
      const statsData = await api.getStudentStats();
      setStats(statsData.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setAnnouncements([]);
      setStats({ pending: 0, approved: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleNav = (key) => {
    navigate(`/student/${key}`);
  };

  const handleNotifications = () => {
    alert("No new notifications at the moment.");
  };

  const handleUpdateClick = (update) => {
    if (update.type === "requirement") {
      navigate("/student/requirements");
    } else {
      navigate("/student/announcements");
    }
  };

  return (
    <div className="portal-page-content">
      <div className="portal-topbar">
        <div className="topbar-right">
          <button 
            className="topbar-icon-btn sh-topbar-document" 
            onClick={() => handleNav("requirements")} 
            title="View Requirements"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              width="40"   
              height="40"  
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="portal-content sh-content">
        <div className="sh-welcome-card">
          <div className="sh-welcome-content">
            <p className="sh-welcome-sub">WELCOME BACK, ATHLETE!</p>
            <h1 className="sh-welcome-name" style={{ color: 'white' }}>{user.name}</h1>
          </div>
          <div className="sh-person-container">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="sh-decor-circle"></div>
        </div>

         <p className="sh-section-label">Quick Action</p>
         <div className="sh-quick-card">
           <p className="sh-quick-title">Sport Requirements</p>
           <p className="sh-quick-desc">{stats.pending} pending • {stats.approved} approved</p>
           <button className="sh-upload-btn" onClick={() => handleNav("requirements")}> 
             <span>View & Upload</span>
             <span className="upload-icon"></span>
           </button>
         </div>

      </div>
    </div>
  );
}
