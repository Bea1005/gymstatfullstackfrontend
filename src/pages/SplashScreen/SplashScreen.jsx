import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logoImage from "../../assets/logo.png";
import "./SplashScreen.css";

export default function SplashScreen() {
  const navigate = useNavigate();
  const redirectAttemptedRef = useRef(false);
  const timerRef = useRef(null);

  const goToOnboarding = () => {
    if (redirectAttemptedRef.current) {
      return;
    }

    redirectAttemptedRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    navigate("/onboarding");
  };

  useEffect(() => {
    if (redirectAttemptedRef.current) {
      return;
    }

    timerRef.current = setTimeout(() => {
      goToOnboarding();
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="splash-root" aria-label="GYMSTAT splash screen">
      <div className="splash-glow splash-glow-left" />
      <div className="splash-glow splash-glow-right" />

      <div className="splash-card">
        <div className="splash-logo-shell">
          <img
            src={logoImage}
            alt="GYMSTAT Logo"
            className="splash-logo-image"
            onClick={goToOnboarding}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                goToOnboarding();
              }
            }}
          />
        </div>

        <div className="splash-loading" aria-live="polite">
          <span className="splash-loading-text">Loading</span>
          <div className="splash-loader-track">
            <div className="splash-loader-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}