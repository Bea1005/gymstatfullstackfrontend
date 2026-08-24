import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SplashScreen from "./pages/SplashScreen/SplashScreen";
import OnboardingScreen from "./pages/SplashScreen/OnboardingScreen";
import LoginPage from "./pages/LoginSignup/LoginPage";
import RegisterPage from "./pages/LoginSignup/RegisterPage";
import PublicCalendar from "./pages/PublicCalendar/PublicCalendar";
import DocumentCenter from "./pages/SplashScreen/DocumentCenter";

// Student Portal Pages
import StudentLayout from "./pages/StudentPortal/StudentLayout";
import StudentHomePage from "./pages/StudentPortal/StudentHome";
import StudentRequirements from "./pages/StudentPortal/StudentRequirements";
import StudentProfile from "./pages/StudentPortal/StudentProfile";
import StudentSettings from "./pages/StudentPortal/StudentSettings";

// Admin Portal Pages
import AdminLayout from "./pages/AdminPortal/AdminLayout";
import AdminDashboard from "./pages/AdminPortal/AdminDashboard";
import AdminUserRecords from "./pages/AdminPortal/AdminUserRecords";
import AdminRequirements from "./pages/AdminPortal/AdminRequirements";
import AdminSchedules from "./pages/AdminPortal/AdminSchedules";
import AdminEquipments from "./pages/AdminPortal/AdminEquipments";
import AdminBorrowing from "./pages/AdminPortal/AdminBorrowing";
import AdminSettings from "./pages/AdminPortal/AdminSettings";

// Coach Portal Pages - Only Home Page
import CoachLayout from "./pages/CoachPortal/CoachLayout";
import CoachRecords from "./pages/CoachPortal/CoachRecords";

// Screener Portal Pages
import ScreenerPage from "./pages/ScreenerPortal/ScreenerPage";

function App() {
  console.log("App is rendering!");
  
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        {/* role selection removed - onboarding now goes to login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Public Calendar */}
        <Route path="/calendar" element={<PublicCalendar />} />
        <Route path="/document-center" element={<DocumentCenter />} />

        {/* Student Portal Routes */}
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="/student/home" />} />
          <Route path="home" element={<StudentHomePage />} />
          <Route path="requirements" element={<StudentRequirements />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>

        {/* Admin Portal Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="user-records" element={<AdminUserRecords />} />
          <Route path="requirements" element={<AdminRequirements />} />
          <Route path="schedules" element={<AdminSchedules />} />
          <Route path="equipments" element={<AdminEquipments />} />
          <Route path="borrowing" element={<AdminBorrowing />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Coach Portal Routes - Only Home Page */}
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<Navigate to="/coach/home" />} />
          <Route path="home" element={<CoachRecords />} />
        </Route>

        {/* Screener Portal Routes */}
        <Route path="/screener" element={<Navigate to="/screener/dashboard" replace />} />
        <Route path="/screener/dashboard" element={<ScreenerPage />} />

        {/* Catch-all route for 404 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;