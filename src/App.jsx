import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SplashScreen from "./pages/SplashScreen/SplashScreen";
import OnboardingScreen from "./pages/SplashScreen/OnboardingScreen";
import LoginPage from "./pages/LoginSignup/LoginPage";
import RegisterPage from "./pages/LoginSignup/RegisterPage";
import DocumentCenter from "./pages/SplashScreen/DocumentCenter";

// Student Portal Pages
const PublicCalendar = lazy(() => import("./pages/PublicCalendar/PublicCalendar"));
const StudentLayout = lazy(() => import("./pages/StudentPortal/StudentLayout"));
const StudentHomePage = lazy(() => import("./pages/StudentPortal/StudentHome"));
const StudentRequirements = lazy(() => import("./pages/StudentPortal/StudentRequirements"));
const StudentProfile = lazy(() => import("./pages/StudentPortal/StudentProfile"));
const StudentSettings = lazy(() => import("./pages/StudentPortal/StudentSettings"));

// Admin Portal Pages
const AdminLayout = lazy(() => import("./pages/AdminPortal/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/AdminPortal/AdminDashboard"));
const AdminUserRecords = lazy(() => import("./pages/AdminPortal/AdminUserRecords"));
const AdminRequirements = lazy(() => import("./pages/AdminPortal/AdminRequirements"));
const AdminSchedules = lazy(() => import("./pages/AdminPortal/AdminSchedules"));
const AdminEquipments = lazy(() => import("./pages/AdminPortal/AdminEquipments"));
const AdminBorrowing = lazy(() => import("./pages/AdminPortal/AdminBorrowing"));
const AdminSettings = lazy(() => import("./pages/AdminPortal/AdminSettings"));

// Coach Portal Pages - Only Home Page
const CoachLayout = lazy(() => import("./pages/CoachPortal/CoachLayout"));
const CoachRecords = lazy(() => import("./pages/CoachPortal/CoachRecords"));

// Screener Portal Pages
const ScreenerPage = lazy(() => import("./pages/ScreenerPortal/ScreenerPage"));

function App() {
  console.log("App is rendering!");
  
  return (
    <Router>
      <Suspense fallback={null}>
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
      </Suspense>
    </Router>
  );
}

export default App;