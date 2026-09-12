import React, { useEffect, useState } from "react";
import * as api from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import { DEPARTMENT_OPTIONS, YEAR_LEVEL_OPTIONS } from "../../constants/studentRegistrationOptions";
import "./StudentProfile.css";

const normalizeDateForInput = (value) => {
  if (!value) return "";
  const dateText = String(value).trim();
  const dateOnly = dateText.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;

  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
};

const getEditableProfileFields = (profile = {}) => ({
  fullname: profile.fullname || profile.name || "",
  username: profile.username || "",
  email: profile.email || "",
  contactNumber: profile.contactNumber || "",
  dateOfBirth: normalizeDateForInput(profile.dateOfBirth || profile.dob),
  department: profile.department || "",
  yearLevel: profile.yearLevel || "",
  sport: profile.sport || "",
  branchCampus: profile.branchCampus || ""
});

const StudentProfile = () => {
  const { notify } = useNotifications();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.getProfile();
        const profile = response.user || response.data || {};
        setUser(profile);
        setForm(getEditableProfileFields(profile));
        if (profile.profilePhoto) {
          const currentPhotoUrl = await api.getProtectedImageObjectUrl("/profile/photo");
          setPhotoUrl(currentPhotoUrl);
        }
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
      Object.entries(getEditableProfileFields(form)).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          formData.append(field, value);
        }
      });
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
      if (photoFile) {
        const currentPhotoUrl = await api.getProtectedImageObjectUrl("/profile/photo");
        setPhotoUrl(currentPhotoUrl);
      }
      setPhotoFile(null);
      setPhotoPreview("");
      setForm(getEditableProfileFields(updatedUser));
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

  const handlePhotoSelect = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoModalOpen(true);
  };

  const closePhotoModal = () => {
    if (!saving) {
      setPhotoModalOpen(false);
      setPhotoFile(null);
      setPhotoPreview("");
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

  const displayedImage = photoPreview || photoUrl;

  return (
    <div className="student-profile-page">
      <header className="student-profile-header">
        <div>
          <p className="student-profile-eyebrow">Student-Athlete</p>
          <h1>Student Profile</h1>
          <p>View your registered information and keep your contact email current.</p>
        </div>
        <button type="button" className="student-profile-avatar" title="View or update profile photo" onClick={() => setPhotoModalOpen(true)}>
          {displayedImage ? <img src={displayedImage} alt="Student profile" /> : (user.fullname || user.name || "S").charAt(0).toUpperCase()}
          {isEditing && <span className="student-profile-avatar__edit">Edit</span>}
        </button>
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
                    {(value === "department" ? DEPARTMENT_OPTIONS : value === "yearLevel" ? YEAR_LEVEL_OPTIONS : ["Boac Main", "Santa Cruz", "Gasan", "Torrijos"]).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input className="student-profile-input" type={value === "dateOfBirth" ? "date" : "text"} value={form[value] || ""} onChange={(event) => setForm((current) => ({ ...current, [value]: event.target.value }))} required={value === "fullname"} />
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

      {photoModalOpen && <div className="student-profile-photo-modal" role="dialog" aria-modal="true" aria-labelledby="student-profile-photo-title" onClick={closePhotoModal}>
        <div className="student-profile-photo-modal__card" onClick={(event) => event.stopPropagation()}>
          <div className="student-profile-photo-modal__header">
            <h2 id="student-profile-photo-title">Profile Photo</h2>
            <button type="button" onClick={closePhotoModal} disabled={saving} aria-label="Close">&times;</button>
          </div>
          <div className="student-profile-photo-modal__preview">
            {displayedImage ? <img src={displayedImage} alt="Current student profile" /> : <span>No profile photo</span>}
          </div>
          <label className="student-profile-button">
            {photoLoading ? "Loading..." : "Choose New Photo"}
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePhotoSelect} disabled={saving || photoLoading} />
          </label>
          {photoFile && <button type="button" className="student-profile-button" onClick={async () => { setPhotoLoading(true); await handleSave({ preventDefault: () => {} }); setPhotoLoading(false); setPhotoModalOpen(false); }} disabled={saving}>Save Photo</button>}
        </div>
      </div>}
    </div>
  );
};

export default StudentProfile;
