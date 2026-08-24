import React, { useEffect, useState } from "react";
import * as api from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import "./StudentProfile.css";

const StudentProfile = () => {
  const departmentOptions = [
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Civil Engineering",
    "Bachelor of Science in Electrical Engineering",
    "Bachelor of Science in Industrial Technology",
    "Bachelor of Science in Agriculture",
    "Bachelor of Science in Fisheries",
    "Bachelor of Science in Forestry",
    "Bachelor of Science in Nursing",
    "Bachelor of Science in Business Administration",
    "Bachelor of Science in Accountancy",
    "Bachelor of Science in Hospitality Management",
    "Bachelor of Science in Tourism Management",
    "Bachelor of Arts in Communication",
    "Bachelor of Arts in Political Science",
    "Bachelor of Elementary Education",
    "Bachelor of Secondary Education",
    "Bachelor of Science in Criminology",
  ];
  const yearLevelOptions = ["I", "II", "III", "IV"];
  const { notify } = useNotifications();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.getProfile();
        const profile = response.user || response.data || {};
        setUser(profile);
        setForm({
          fullname: profile.fullname || profile.name || "",
          username: profile.username || "",
          email: profile.email || "",
          contactNumber: profile.contactNumber || "",
          dateOfBirth: profile.dateOfBirth || profile.dob || "",
          department: profile.department || "",
          yearLevel: profile.yearLevel || "",
          sport: profile.sport || "",
          branchCampus: profile.branchCampus || ""
        });
      } catch (error) {
        notify("error", "Unable to load profile", error.message || "Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [notify]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([field, value]) => formData.append(field, value));
      if (photoFile) formData.append("profilePhoto", photoFile);

      await api.updateProfile(formData);
      const refreshedResponse = await api.getProfile();
      const updatedUser = refreshedResponse.user || refreshedResponse.data;
      if (!updatedUser) {
        throw new Error("The profile was saved, but the updated user record could not be retrieved.");
      }
      if (updatedUser.dateOfBirth !== form.dateOfBirth || updatedUser.yearLevel !== form.yearLevel || updatedUser.branchCampus !== form.branchCampus) {
        throw new Error("The profile was saved, but Date of Birth, Year Level, or Branch Campus was not persisted.");
      }
      setUser(updatedUser);
      setPhotoFile(null);
      setPhotoPreview("");
      setForm((current) => ({ ...current, ...updatedUser }));
      localStorage.setItem("user", JSON.stringify(updatedUser));
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
      setIsEditing(false);
      notify("success", "Profile updated", "Your profile changes were saved successfully.");
    } catch (error) {
      notify("error", "Unable to update profile", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displayValue = (value) => value || "Not provided";

  if (loading) {
    return <div className="student-profile-page"><p className="student-profile-status">Loading profile...</p></div>;
  }

  if (!user) {
    return <div className="student-profile-page"><p className="student-profile-status">Profile information is unavailable.</p></div>;
  }

  const departmentDisplay = [user.department, user.yearLevel].filter(Boolean).join(" - ");

  const profileFields = [
    ["Student ID", user.id || user.studentNumber, false],
    ["Full Name", "fullname", true],
    ["Date of Birth", "dateOfBirth", true],
    ["Department", "department", true],
    ["Year Level", "yearLevel", true],
    ["Sport", "sport", true],
    ["Branch Campus", "branchCampus", true],
    ["Username", "username", true],
  ];

  const imageUrl = user.profilePhoto
    ? `${user.profilePhoto}${user.profilePhoto.startsWith("http") ? "" : `?v=${encodeURIComponent(user.updatedAt || "")}`}`
    : "";
  const displayedImage = photoPreview || imageUrl;

  return (
    <div className="student-profile-page">
      <header className="student-profile-header">
        <div>
          <p className="student-profile-eyebrow">Student Athlete</p>
          <h1>Student Profile</h1>
          <p>View your registered information and keep your contact email current.</p>
        </div>
        <label className="student-profile-avatar" title="Update profile photo">
          {displayedImage ? <img src={displayedImage} alt="Student profile" /> : (user.fullname || user.name || "S").charAt(0).toUpperCase()}
          {isEditing && <span className="student-profile-avatar__edit">Edit</span>}
          <input type="file" accept="image/jpeg,image/png,image/gif" onChange={(event) => { const file = event.target.files?.[0] || null; setPhotoFile(file); setPhotoPreview(file ? URL.createObjectURL(file) : ""); }} disabled={!isEditing} />
        </label>
      </header>

      <section className="student-profile-card">
        <div className="student-profile-card__heading">
          <div>
            <p className="student-profile-section-label">Personal Information</p>
            <h2>{displayValue(user.fullname || user.name)}</h2>
          </div>
          {!isEditing && <button type="button" className="student-profile-button" onClick={() => setIsEditing(true)}>Edit Profile</button>}
          {isEditing && <span className="student-profile-edit-hint">Select a field or photo to edit</span>}
        </div>

        <div className="student-profile-grid">
          {profileFields.map(([label, value, editable]) => {
            if (!isEditing && value === "yearLevel") return null;

            return (
              <div className="student-profile-field" key={label}>
                <span>{label}</span>
                {isEditing && editable ? (
                value === "branchCampus" || value === "department" || value === "yearLevel" ? (
                  <select className="student-profile-input" value={form[value] || ""} onChange={(event) => setForm((current) => ({ ...current, [value]: event.target.value }))}>
                    <option value="">{value === "department" ? "Select department" : value === "yearLevel" ? "Select year level" : "Select branch campus"}</option>
                    {(value === "department" ? departmentOptions : value === "yearLevel" ? yearLevelOptions : ["Boac Main", "Santa Cruz", "Gasan", "Torrijos"]).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input className="student-profile-input" value={form[value] || ""} onChange={(event) => setForm((current) => ({ ...current, [value]: event.target.value }))} required={value === "fullname"} />
                )
                ) : <strong>{value === "department" ? displayValue(departmentDisplay) : displayValue(editable ? form[value] : value)}</strong>}
              </div>
            );
          })}
          <div className="student-profile-field">
            <span>Contact Information</span>
            {isEditing ? <input className="student-profile-input" value={form.contactNumber || ""} onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))} /> : <strong>{displayValue(user.contactNumber || user.phone || user.contact)}</strong>}
          </div>
          <div className="student-profile-field">
            <span>Email</span>
            {isEditing ? <input className="student-profile-input" type="email" value={form.email || ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /> : <strong>{displayValue(user.email)}</strong>}
          </div>
        </div>
        {isEditing && <form className="student-profile-form-actions" onSubmit={handleSave}>
          <button type="button" className="student-profile-button student-profile-button--quiet" onClick={() => setIsEditing(false)}>Cancel</button>
          <button type="submit" className="student-profile-button" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </form>}
      </section>

      <p className="student-profile-note">Student ID is managed by GymStat administrators. Username changes must be unique.</p>
    </div>
  );
};

export default StudentProfile;
