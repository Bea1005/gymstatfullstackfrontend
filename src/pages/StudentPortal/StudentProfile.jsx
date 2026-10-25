import React, { useEffect, useRef, useState } from "react";
import * as api from "../../services/api";
import { useNotifications } from "../../components/useNotifications";
import { DEPARTMENT_OPTIONS, SPORT_OPTIONS, YEAR_LEVEL_OPTIONS } from "../../constants/studentRegistrationOptions";
import {
  PREFERRED_CATEGORY_OPTIONS,
  REGISTRATION_CATEGORIES,
} from "../../constants/registrationCategories";
import "./StudentProfile.css";

const MAX_PROFILE_SPORTS = 34;

const normalizeDateForInput = (value) => {
  if (!value) return "";
  const dateText = String(value).trim();
  const dateOnly = dateText.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;

  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
};

const getEditableProfileFields = (profile = {}) => {
  const savedSports = Array.isArray(profile.sports) && profile.sports.length
    ? profile.sports
    : [profile.sport];
  const sports = [...new Set(savedSports.map((sport) => String(sport || "").trim()).filter(Boolean))];

  return {
    fullname: profile.fullname || profile.name || "",
    email: profile.email || "",
    contactNumber: profile.contactNumber || "",
    dateOfBirth: normalizeDateForInput(profile.dateOfBirth || profile.dob),
    department: profile.department || "",
    yearLevel: profile.yearLevel || "",
    sport: sports[0] || "",
    sports: sports.length ? sports : [""],
    branchCampus: profile.branchCampus || ""
  };
};

const StudentProfile = () => {
  const { notify } = useNotifications();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveInProgressRef = useRef(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [newSportCategory, setNewSportCategory] = useState("");
  const [newSportSubcategory, setNewSportSubcategory] = useState("");
  const [newSportValue, setNewSportValue] = useState("");
  const [newPreferredCategory, setNewPreferredCategory] = useState("");
  const selectedSportCategory = REGISTRATION_CATEGORIES.find(({ name }) => name === newSportCategory);
  const selectedSportSubcategory = selectedSportCategory?.subcategories?.find(
    ({ name }) => name === newSportSubcategory,
  );
  const newSportOptions = newSportCategory === "Sports Event"
    ? selectedSportSubcategory?.sports || []
    : selectedSportCategory?.events || [];

  const resetNewSportSelection = () => {
    setAddingSport(false);
    setNewSportCategory("");
    setNewSportSubcategory("");
    setNewSportValue("");
    setNewPreferredCategory("");
  };

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
    if (saveInProgressRef.current) return;
    const currentSports = (form.sports || [])
      .map((sport) => String(sport || "").trim());
    const selectedSports = currentSports.filter(Boolean);
    if (
      currentSports.some((sport) => !sport)
      || !selectedSports.length
      || selectedSports.length > MAX_PROFILE_SPORTS
      || new Set(selectedSports).size !== selectedSports.length
    ) {
      notify("warning", "Invalid Sports", "Select at least one valid sport or event and remove any duplicates before saving.");
      return;
    }

    saveInProgressRef.current = true;
    setSaving(true);

    try {
      const formData = new FormData();
      Object.entries(getEditableProfileFields(form)).forEach(([field, value]) => {
        if (field === "sports") {
          formData.append(field, JSON.stringify(value));
          return;
        }
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
      const persistedSports = Array.isArray(updatedUser.sports) && updatedUser.sports.length
        ? updatedUser.sports
        : [updatedUser.sport].filter(Boolean);
      if (updatedUser.dateOfBirth !== form.dateOfBirth
        || updatedUser.yearLevel !== form.yearLevel
        || updatedUser.branchCampus !== form.branchCampus
        || JSON.stringify(persistedSports) !== JSON.stringify(form.sports)) {
        throw new Error("The profile was saved, but one or more profile fields or sports were not persisted.");
      }
      setUser(updatedUser);
      if (photoFile) {
        const currentPhotoUrl = await api.getProtectedImageObjectUrl("/profile/photo");
        setPhotoUrl(currentPhotoUrl);
      }
      setPhotoFile(null);
      setPhotoPreview("");
      resetNewSportSelection();
      setForm(getEditableProfileFields(updatedUser));
      localStorage.setItem("user", JSON.stringify(updatedUser));
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
      setIsEditing(false);
    } catch (error) {
      notify("error", "Unable to update profile", error.message || "Please try again.");
    } finally {
      saveInProgressRef.current = false;
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

  const handleAddSport = () => {
    if (
      !selectedSportCategory
      || (newSportCategory === "Sports Event" && !selectedSportSubcategory)
      || !newSportOptions.includes(newSportValue)
      || (newPreferredCategory && !PREFERRED_CATEGORY_OPTIONS.includes(newPreferredCategory))
    ) {
      notify("warning", "Incomplete Sport or Event", "Select a category and a valid sport or event before adding it.");
      return;
    }

    const currentSports = (form.sports || []).filter(Boolean);
    if (currentSports.includes(newSportValue)) {
      notify("warning", "Duplicate Sport or Event", "This sport or event is already in your profile.");
      return;
    }
    if (currentSports.length >= MAX_PROFILE_SPORTS) {
      notify("warning", "Sport Limit Reached", `You can add up to ${MAX_PROFILE_SPORTS} sports or events.`);
      return;
    }

    const sports = [...currentSports, newSportValue];
    setForm((current) => ({ ...current, sports, sport: sports[0] || "" }));
    resetNewSportSelection();
  };

  const handleExistingSportChange = (index, selectedSport) => {
    if ((form.sports || []).some((sport, sportIndex) => sportIndex !== index && sport === selectedSport)) {
      notify("warning", "Duplicate Sport or Event", "This sport or event is already in your profile.");
      return;
    }

    setForm((current) => {
      const sports = [...(current.sports || [])];
      sports[index] = selectedSport;
      return { ...current, sports, sport: sports[0] || "" };
    });
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
    ["Program", "department", true],
    ["Year Level", "yearLevel", true],
    ["Sport", "sports", true],
    ["Branch Campus", "branchCampus", true],
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
                value === "sports" ? (
                  <div className="student-profile-sports">
                    {(form.sports || []).map((sport, index) => (
                      <div className="student-profile-sport-row" key={`${sport || "sport"}-${index}`}>
                        <select
                          className="student-profile-input"
                          value={sport}
                          onChange={(event) => handleExistingSportChange(index, event.target.value)}
                          required
                        >
                          <option value="" disabled>Select Sport</option>
                          {sport && !SPORT_OPTIONS.includes(sport) && <option value={sport}>{sport}</option>}
                          {SPORT_OPTIONS.filter((option) => !form.sports.includes(option) || option === sport).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        {index === 0 ? (
                          <button
                            type="button"
                            className="student-profile-sport-add"
                            onClick={() => {
                              if (addingSport) {
                                resetNewSportSelection();
                              } else {
                                setAddingSport(true);
                              }
                            }}
                            disabled={(form.sports || []).filter(Boolean).length >= MAX_PROFILE_SPORTS}
                          >
                            {addingSport ? "Close Add Sport" : "Add Sport"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="student-profile-sport-remove"
                            onClick={() => setForm((current) => {
                              const sports = current.sports.filter((_, sportIndex) => sportIndex !== index);
                              return { ...current, sports, sport: sports[0] || "" };
                            })}
                            aria-label={`Remove ${sport || "additional sport"}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {addingSport && (
                      <div className="student-profile-sport-add-flow">
                        <select
                          className="student-profile-input"
                          value={newSportCategory}
                          onChange={(event) => {
                            setNewSportCategory(event.target.value);
                            setNewSportSubcategory("");
                            setNewSportValue("");
                            setNewPreferredCategory("");
                          }}
                        >
                          <option value="">Select Category</option>
                          {REGISTRATION_CATEGORIES.map(({ name }) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        {newSportCategory === "Sports Event" && (
                          <select
                            className="student-profile-input"
                            value={newSportSubcategory}
                            onChange={(event) => {
                              setNewSportSubcategory(event.target.value);
                              setNewSportValue("");
                              setNewPreferredCategory("");
                            }}
                          >
                            <option value="">Select Sports Subcategory</option>
                            {selectedSportCategory.subcategories.map(({ name }) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        )}
                        {newSportOptions.length > 0 && (
                          <select
                            className="student-profile-input"
                            value={newSportValue}
                            onChange={(event) => setNewSportValue(event.target.value)}
                          >
                            <option value="">
                              Select {newSportCategory === "Sports Event" ? "Sport" : "Event"}
                            </option>
                            {newSportOptions.map((option) => (
                              <option
                                key={option}
                                value={option}
                                disabled={(form.sports || []).includes(option)}
                              >
                                {option}
                              </option>
                            ))}
                          </select>
                        )}
                        {newSportSubcategory === "Racket & Net Sports" && (
                          <label className="student-profile-preferred-category">
                            <span>Preferred Category (not saved to profile)</span>
                            <select
                              className="student-profile-input"
                              value={newPreferredCategory}
                              onChange={(event) => setNewPreferredCategory(event.target.value)}
                            >
                              <option value="">Select Preferred Category (Optional)</option>
                              {PREFERRED_CATEGORY_OPTIONS.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="student-profile-sport-add-actions">
                          <button
                            type="button"
                            className="student-profile-sport-add"
                            onClick={handleAddSport}
                            disabled={
                              !newSportValue
                              || (form.sports || []).includes(newSportValue)
                              || (form.sports || []).filter(Boolean).length >= MAX_PROFILE_SPORTS
                            }
                          >
                            Add Selected Sport/Event
                          </button>
                          <button
                            type="button"
                            className="student-profile-sport-remove"
                            onClick={resetNewSportSelection}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : value === "branchCampus" || value === "department" || value === "yearLevel" ? (
                  <select className="student-profile-input" value={form[value] || ""} onChange={(event) => setForm((current) => ({ ...current, [value]: event.target.value }))}>
                    <option value="" disabled>{value === "department" ? "Select Department" : value === "yearLevel" ? "Select Year Level" : "Select Branch Campus"}</option>
                    {(value === "department" ? DEPARTMENT_OPTIONS : value === "yearLevel" ? YEAR_LEVEL_OPTIONS : ["Boac Main", "Santa Cruz", "Gasan", "Torrijos"]).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input className="student-profile-input" type={value === "dateOfBirth" ? "date" : "text"} value={form[value] || ""} onChange={(event) => setForm((current) => ({ ...current, [value]: event.target.value }))} required={value === "fullname"} />
                )
                ) : <strong>{value === "department"
                  ? displayValue(departmentDisplay)
                  : value === "sports"
                    ? displayValue((form.sports || []).join(", "))
                    : displayValue(editable ? form[value] : value)}</strong>}
              </div>
            );
          })}
          <div className="student-profile-field">
            <span>Contact Number</span>
            {isEditing ? <input className="student-profile-input" value={form.contactNumber || ""} onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))} /> : <strong>{displayValue(user.contactNumber || user.phone || user.contact)}</strong>}
          </div>
          <div className="student-profile-field">
            <span>Email</span>
            {isEditing ? <input className="student-profile-input" type="email" value={form.email || ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /> : <strong>{displayValue(user.email)}</strong>}
          </div>
        </div>
        {isEditing && <form className="student-profile-form-actions" onSubmit={handleSave}>
          <button type="button" className="student-profile-button student-profile-button--quiet" onClick={() => { resetNewSportSelection(); setIsEditing(false); }}>Cancel</button>
          <button type="submit" className="student-profile-button" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </form>}
      </section>

      <p className="student-profile-note">Student ID is managed by GymStat administrators.</p>

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
