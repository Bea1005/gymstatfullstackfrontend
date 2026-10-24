import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import * as api from "../../services/api";
import "./StudentPortal.css";

const UPDATES = [
  { id: 1, title: "Team 1 Basketball Team Training", date: "January 23, 2026", time: "8AM�10AM", type: "training" },
  { id: 2, title: "Intramural Requirements 2026", date: "January 14, 2026", time: "All Day", type: "requirement" },
];

export default function StudentHomePage() {
  const navigate = useNavigate();
  const { user: authenticatedUser } = useOutletContext();
  const user = {
    name: authenticatedUser?.fullname || "Athlete",
    email: authenticatedUser?.email || "student@marsu.edu",
  };
  const [stats, setStats] = useState({ pending: 0, approved: 0 });

  async function fetchData() {
    try {
      await api.getAnnouncements({ limit: 5 });
      const statsData = await api.getStudentStats();
      setStats(statsData.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setStats({ pending: 0, approved: 0 });
    }
  }

  useEffect(() => {
    const fetchTimeout = setTimeout(fetchData, 0);
    return () => clearTimeout(fetchTimeout);
  }, [navigate]);

  const handleNav = (key) => {
    navigate(`/student/${key}`);
  };

  return (
    <div className="portal-page-content">
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

           <section className="sh-quick-tip" aria-labelledby="sh-quick-tip-title">
             <h2 id="sh-quick-tip-title">GYMSTAT Quick Tip</h2>
             <p>
               Keep your student information and submitted requirements updated. Before uploading a document, make sure it is clear, complete, valid, and belongs to you. Regularly check your requirement status and notifications so you do not miss important updates.
             </p>
             <p className="sh-quick-tip__support">
               Tip: Check your Requirements page regularly for pending or updated submissions.
             </p>
           </section>

      </div>
    </div>
  );
}
