import { useNavigate } from "react-router-dom";
import logoImage from "../../assets/logo.png";
import "./SplashScreen.css";

export default function SplashScreen() {
  const navigate = useNavigate();

  return (
    <div className="splash-root">
      <img
        src={logoImage}
        alt="GYMSTAT Logo"
        className="splash-logo-image"
        onClick={() => navigate("/onboarding")} // ✅ Changed from "/roles" to "/onboarding"
      />
    </div>
  );
}