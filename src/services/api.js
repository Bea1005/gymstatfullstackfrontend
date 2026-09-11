// src/services/api.js
// Use Vite proxy for development, full URL for production
const configuredApiUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');

if (import.meta.env.PROD && /^http:\/\//i.test(configuredApiUrl)) {
  throw new Error('VITE_API_URL must use HTTPS in production');
}

const API_URL = configuredApiUrl;

// List of public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  '/login',
  '/register',
  '/forgot-password',
  '/student/announcements',
  '/health',
];

const PUBLIC_GET_ENDPOINTS = [
  '/schedules',
];

// Helper function to check if endpoint is public
const isPublicEndpoint = (endpoint, method = 'GET') => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (normalizedEndpoint === '/schedule-requests' && method === 'POST') {
    return true;
  }

  if ((normalizedEndpoint === '/forgot-password' || normalizedEndpoint === '/login' || normalizedEndpoint === '/register') && method === 'POST') {
    return true;
  }

  if (method !== 'GET') {
    return false;
  }

  return PUBLIC_ENDPOINTS.some(publicEndpoint => 
    normalizedEndpoint === publicEndpoint || 
    normalizedEndpoint.startsWith(publicEndpoint + '?') ||
    normalizedEndpoint.startsWith(publicEndpoint + '/')
  ) || PUBLIC_GET_ENDPOINTS.some(publicEndpoint => 
    normalizedEndpoint === publicEndpoint || 
    normalizedEndpoint.startsWith(publicEndpoint + '?') ||
    normalizedEndpoint.startsWith(publicEndpoint + '/')
  );
};

// Helper function for API requests with proper token handling
const apiRequest = async (endpoint, options = {}) => {
  try {
    const headers = {
      ...options.headers,
    };

    // Only add Content-Type for non-FormData requests
    // DON'T set Content-Type for FormData - browser will set it with boundary
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    } else {
      // Remove Content-Type for FormData (browser will add it)
      delete headers['Content-Type'];
    }

    // Check if this is a public endpoint
    const isPublic = isPublicEndpoint(endpoint, options.method || 'GET');
    
    // Only add auth token for non-public endpoints
    if (!isPublic) {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const fullUrl = `${API_URL}${endpoint}`;

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });
    
    let data;
    const contentType = response.headers.get('content-type');
    
    // Handle different response types
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && contentType.includes('application/octet-stream')) {
      // For file downloads
      return response;
    } else {
      data = await response.text();
    }
    
    if (!response.ok) {
      if (response.status === 401 && !isPublic && typeof window !== 'undefined') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.assign('/login?session=expired');
        }
      }

      const serverMessage = typeof data === 'object' && data !== null
        ? data.message || data.error
        : '';
      throw new Error(serverMessage || (response.status >= 500
        ? 'The service is temporarily unavailable. Please try again.'
        : `Request failed (${response.status}). Please check your information and try again.`));
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// Auth Endpoints - Using ID instead of email
export const login = async (id, password) => {
  return apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
};

// Register with ID-based authentication
export const register = async (userData) => {
  return apiRequest('/register', {
    method: 'POST',
    body: JSON.stringify({
      fullname: userData.fullname,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      department: userData.department || "",
      yearLevel: userData.yearLevel || "",
      ...(userData.role === "student" ? { sport: userData.sport || "" } : {}),
      id: userData.id,
      role: userData.role || "student"
    }),
  });
};

export const forgotPassword = async ({ id, email, newPassword }) => {
  return apiRequest('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ id, email, newPassword }),
  });
};

// ========== EQUIPMENT ENDPOINTS ==========

// Get all equipment (masterlist)
export const getEquipment = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/admin/equipment?${params}`, {
    method: 'GET',
  });
};

// Get single equipment by ID
export const getEquipmentById = async (id) => {
  return apiRequest(`/admin/equipment/${id}`, {
    method: 'GET',
  });
};

// Register new equipment (auto-updates if exists, adds 1 unit)
export const registerEquipment = async (equipmentData) => {
  return apiRequest('/admin/equipment', {
    method: 'POST',
    body: JSON.stringify({
      name: equipmentData.name,
      type: equipmentData.type,
      category: equipmentData.category || equipmentData.type,
      referenceId: equipmentData.referenceId,
      condition: equipmentData.condition || 'Good'
    }),
  });
};

// Update equipment details
export const updateEquipment = async (id, equipmentData) => {
  return apiRequest(`/admin/equipment/${id}`, {
    method: 'PUT',
    body: JSON.stringify(equipmentData),
  });
};

// Delete equipment (only if not on loan)
export const deleteEquipment = async (id) => {
  return apiRequest(`/admin/equipment/${id}`, {
    method: 'DELETE',
  });
};

// Borrow equipment (decreases available quantity)
export const borrowEquipment = async (id, quantity) => {
  return apiRequest(`/admin/equipment/${id}/borrow`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
};

// Return equipment (increases available quantity)
export const returnEquipment = async (id, quantity) => {
  return apiRequest(`/admin/equipment/${id}/return`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
};

// Get equipment options for dropdown
export const getEquipmentOptions = async () => {
  return apiRequest('/admin/equipment/options', {
    method: 'GET',
  });
};

// Get equipment statistics
export const getEquipmentStats = async () => {
  return apiRequest('/admin/equipment/stats', {
    method: 'GET',
  });
};

// Get low stock equipment
export const getLowStockEquipment = async () => {
  return apiRequest('/admin/equipment/low-stock', {
    method: 'GET',
  });
};

// Get out of stock equipment
export const getOutOfStockEquipment = async () => {
  return apiRequest('/admin/equipment/out-of-stock', {
    method: 'GET',
  });
};

// Get equipment categories for filtering
export const getEquipmentCategories = async () => {
  return apiRequest('/admin/equipment/categories', {
    method: 'GET',
  });
};

// ========== BORROWING ENDPOINTS ==========

// Get all borrowing records
export const getBorrowingRecords = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/admin/borrowing?${params}`, {
    method: 'GET',
  });
};

// Create new borrowing record
export const createBorrowingRecord = async (borrowData) => {
  return apiRequest('/admin/borrowing', {
    method: 'POST',
    body: JSON.stringify(borrowData),
  });
};

// Update borrowing record
export const updateBorrowingRecord = async (id, borrowData) => {
  return apiRequest(`/admin/borrowing/${id}`, {
    method: 'PUT',
    body: JSON.stringify(borrowData),
  });
};

// Return borrowed equipment
export const returnBorrowedEquipment = async (id, returnData) => {
  return apiRequest(`/admin/borrowing/${id}/return`, {
    method: 'PUT',
    body: JSON.stringify(returnData),
  });
};

// Delete borrowing record
export const deleteBorrowingRecord = async (id) => {
  return apiRequest(`/admin/borrowing/${id}`, {
    method: 'DELETE',
  });
};

// Get borrowing statistics
export const getBorrowingStats = async () => {
  return apiRequest('/admin/borrowing/stats', {
    method: 'GET',
  });
};

// Get Admin Dashboard stats (counts + upcoming schedules)
export const getAdminDashboard = async () => {
  return apiRequest('/admin/dashboard', {
    method: 'GET',
  });
};

// ========== USER MANAGEMENT ENDPOINTS (Admin) ==========
// Get all users by role
export const getAllUsers = async (role = null) => {
  const endpoint = role ? `/users?role=${role}` : '/users';
  return apiRequest(endpoint, {
    method: 'GET',
  });
};

// Get all students (admin view)
export const getAdminStudents = async () => {
  return apiRequest('/users?role=student', {
    method: 'GET',
  });
};

// Get all screeners (admin view)
export const getAdminScreeners = async () => {
  return apiRequest('/users?role=screener', {
    method: 'GET',
  });
};

// Create new user (admin only - for students/screeners)
export const createUser = async (userData) => {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

// Delete single user by ID
export const deleteUser = async (userId) => {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  });
};

// Delete multiple users by ID (bulk delete)
export const deleteUsers = async (userIds) => {
  return apiRequest('/users/bulk-delete', {
    method: 'DELETE',
    body: JSON.stringify({ ids: userIds }),
  });
};

// ========== USER PROFILE ENDPOINTS ==========

// Get current user profile
export const getProfile = async () => {
  return apiRequest('/profile', {
    method: 'GET',
  });
};

// Update user profile
export const updateProfile = async (userData) => {
  return apiRequest('/profile', {
    method: 'PUT',
    body: userData instanceof FormData ? userData : JSON.stringify(userData),
  });
};

// Get all students (for screener/admin)
export const getStudents = async () => {
  return apiRequest('/screener/students', {
    method: 'GET',
  });
};

// Verify student requirement (for screener)
export const verifyStudent = async (studentId, status, requirementType, remarks = "") => {
  return apiRequest(`/screener/verify/${studentId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, requirementType, remarks }),
  });
};

// ========== ADMIN REQUIREMENT ENDPOINTS ==========

// Create new requirement (Admin)
export const createRequirement = async (requirementData, file) => {
  // If file is provided, use FormData
  if (file) {
    const formData = new FormData();
    formData.append('title', requirementData.title);
    formData.append('description', requirementData.description);
    formData.append('type', requirementData.type);
    formData.append('sport', requirementData.sport);
    formData.append('priority', requirementData.priority);
    formData.append('dueDate', requirementData.dueDate);
    formData.append('instructions', requirementData.instructions);
    formData.append('targetStudents', requirementData.targetStudents);
    formData.append('isActive', String(requirementData.isActive));
    formData.append('file', file); // Add the actual file

    return apiRequest('/requirements', {
      method: 'POST',
      body: formData,
    });
  } else {
    // Fall back to JSON if no file
    return apiRequest('/requirements', {
      method: 'POST',
      body: JSON.stringify(requirementData),
    });
  }
};

// Publish requirement (Admin)
export const publishRequirement = async (requirementId) => {
  return apiRequest(`/requirements/${requirementId}/publish`, {
    method: 'POST',
  });
};

// Get all requirements (Admin - includes drafts)
export const getAllRequirements = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/requirements?${params}`, {
    method: 'GET',
  });
};

// Get published requirements (Student view)
export const getPublishedRequirements = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/requirements/published?${params}`, {
    method: 'GET',
  });
};

// Update requirement (Admin)
export const updateAdminRequirement = async (requirementId, updateData) => {
  return apiRequest(`/requirements/${requirementId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

// Delete requirement (Admin)
export const deleteAdminRequirement = async (requirementId) => {
  return apiRequest(`/requirements/${requirementId}`, {
    method: 'DELETE',
  });
};

// Submit requirement (Student)
export const submitRequirementCompletion = async (requirementId, submissionData) => {
  return apiRequest(`/requirements/${requirementId}/submit`, {
    method: 'POST',
    body: JSON.stringify(submissionData),
  });
};

// Get my submissions (Student)
export const getMySubmissions = async () => {
  return apiRequest('/requirements/my/submissions', {
    method: 'GET',
  });
};

// Get all submissions (Admin)
export const getAllSubmissions = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/requirements/admin/submissions?${params}`, {
    method: 'GET',
  });
};

// Review submission (Admin)
export const reviewSubmission = async (submissionId, reviewData) => {
  return apiRequest(`/requirements/submissions/${submissionId}/review`, {
    method: 'PUT',
    body: JSON.stringify(reviewData),
  });
};

// ========== STUDENT REQUIREMENT SUBMISSION ENDPOINTS ==========

// Upload a new requirement file
export const uploadRequirement = async (
  file,
  requirementType,
  sport = 'General',
  participationType = 'Intrams',
  customRequirementId = '',
  customRequirementLabel = ''
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('requirementType', requirementType);
  formData.append('sport', sport);
  formData.append('participationType', participationType);

  if (customRequirementId) {
    formData.append('requirementId', customRequirementId);
  }

  if (customRequirementLabel) {
    formData.append('customRequirementLabel', customRequirementLabel);
  }

  return apiRequest('/student/requirements', {
    method: 'POST',
    body: formData,
  });
};

// Get all student requirements
export const getStudentRequirements = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/student/requirements?${params}`, {
    method: 'GET',
  });
};

export const importPreviousYearRequirements = async (payload = {}) => {
  return apiRequest('/student/requirements/import-previous-year', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// Delete a student requirement
export const deleteRequirement = async (requirementId) => {
  return apiRequest(`/student/requirements/${requirementId}`, {
    method: 'DELETE',
  });
};

// Download a requirement file
export const downloadRequirement = async (requirementId, filename = 'requirement.pdf', participationType = 'Intrams') => {
  try {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const headers = {
      'Authorization': token ? `Bearer ${token}` : undefined
    };

    const fullUrl = `${API_URL}/student/requirements/${requirementId}/download?participationType=${encodeURIComponent(participationType)}`;
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: Object.fromEntries(Object.entries(headers).filter(([_, v]) => v != null))
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to download file');
    }

    const contentDisposition = response.headers.get('content-disposition');
    let finalFilename = filename;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"\s]+)"?/);
      if (match) finalFilename = match[1];
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, message: 'File downloaded successfully' };
  } catch (error) {
    console.error('❌ Download error:', error);
    throw error;
  }
};

export const viewRequirement = async (requirementId, filename = 'requirement.pdf', participationType = 'Intrams') => {
  try {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const headers = {
      'Authorization': token ? `Bearer ${token}` : undefined
    };

    const fullUrl = `${API_URL}/student/requirements/${requirementId}/download?participationType=${encodeURIComponent(participationType)}`;
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: Object.fromEntries(Object.entries(headers).filter(([_, v]) => v != null))
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to open file');
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const fileType = response.headers.get('content-type') || '';

    return {
      success: true,
      url: objectUrl,
      fileType,
      filename
    };
  } catch (error) {
    console.error('❌ View error:', error);
    throw error;
  }
};

// Get student stats (pending and approved counts)
export const getStudentStats = async () => {
  return apiRequest('/student/stats', {
    method: 'GET',
  });
};

// Screener requirements endpoints - Make sure these are in your api.js
export const getScreenerRequirements = async (participationType = 'Intrams') => {
  return apiRequest(`/screener/requirements?participationType=${encodeURIComponent(participationType)}`, {
    method: 'GET',
  });
};

export const reviewScreenerRequirement = async (submissionId, reviewData) => {
  return apiRequest(`/screener/requirements/${submissionId}/review`, {
    method: 'PUT',
    body: JSON.stringify(reviewData),
  });
};

export const markScreenerRequirementViewed = async (submissionId, participationType = 'Intrams') => {
  return apiRequest(`/screener/requirements/${submissionId}/viewed`, {
    method: 'PUT',
    body: JSON.stringify({ participationType }),
  });
};

// Get all announcements
export const getAnnouncements = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/student/announcements?${params}`, {
    method: 'GET',
  });
};

// ========== COACH ENDPOINTS ==========

// Coach profile helpers
export const getCoachProfile = async () => {
  return apiRequest('/coach/profile', {
    method: 'GET',
  });
};

export const updateCoachProfile = async (profileData) => {
  return apiRequest('/coach/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

// Coach announcements
export const getCoachUpdates = async () => {
  return apiRequest('/coach/updates', {
    method: 'GET',
  });
};

// Get coach's athletes
export const getCoachAthletes = async (sport) => {
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  return apiRequest(`/coach/athletes${query}`, {
    method: 'GET',
  });
};

export const getCoachStudentDirectory = async (sport) => {
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  return apiRequest(`/coach/student-directory${query}`, {
    method: 'GET',
  });
};

export const updateCoachAthlete = async (athleteId, athleteData) => {
  return apiRequest(`/coach/athletes/${athleteId}`, {
    method: 'PUT',
    body: JSON.stringify(athleteData),
  });
};

export const createCoachAthlete = async (athleteData) => {
  return apiRequest('/coach/athletes', {
    method: 'POST',
    body: JSON.stringify(athleteData),
  });
};

export const deleteCoachAthlete = async (athleteId) => {
  return apiRequest(`/coach/athletes/${athleteId}`, {
    method: 'DELETE',
  });
};

// Update athlete status
export const updateAthleteStatus = async (athleteId, status) => {
  return apiRequest(`/coach/athletes/${athleteId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

// ========== SCHEDULE REQUEST ENDPOINTS ==========

// Create a new schedule request (PUBLIC - no auth required)
export const createScheduleRequest = async (requestData) => {
  return apiRequest('/schedule-requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
};

// Get all schedule requests (Admin only)
export const getScheduleRequests = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/schedule-requests?${params}`, {
    method: 'GET',
  });
};

// Get schedule request by ID (Admin only)
export const getScheduleRequestById = async (id) => {
  return apiRequest(`/schedule-requests/${id}`, {
    method: 'GET',
  });
};

// Update schedule request status (Admin only)
export const updateScheduleRequest = async (id, updateData) => {
  return apiRequest(`/schedule-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

// Delete schedule request (Admin only)
export const deleteScheduleRequest = async (id) => {
  return apiRequest(`/schedule-requests/${id}`, {
    method: 'DELETE',
  });
};

// Get schedule requests by status (Admin only)
export const getScheduleRequestsByStatus = async (status) => {
  return apiRequest(`/schedule-requests/status/${status}`, {
    method: 'GET',
  });
};

// ========== SCHEDULE ENDPOINTS ==========

// Get all schedules (Public)
export const getSchedules = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return apiRequest(`/schedules?${params}`, {
    method: 'GET',
  });
};

// Get schedules by date range (Public)
export const getSchedulesByDateRange = async (startDate, endDate) => {
  return apiRequest(`/schedules/date-range?startDate=${startDate}&endDate=${endDate}`, {
    method: 'GET',
  });
};

// Get schedule by ID (Public)
export const getScheduleById = async (id) => {
  return apiRequest(`/schedules/${id}`, {
    method: 'GET',
  });
};

// Create schedule (Admin only)
export const createSchedule = async (scheduleData) => {
  return apiRequest('/schedules', {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });
};

// Update schedule (Admin only)
export const updateSchedule = async (id, scheduleData) => {
  return apiRequest(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(scheduleData),
  });
};

// Delete schedule (Admin only)
export const deleteSchedule = async (id) => {
  return apiRequest(`/schedules/${id}`, {
    method: 'DELETE',
  });
};

// Export all
export default { 
  login, 
  register,
  // Equipment
  getEquipment,
  getEquipmentById,
  registerEquipment,
  updateEquipment,
  deleteEquipment,
  borrowEquipment,
  returnEquipment,
  getEquipmentOptions,
  getEquipmentStats,
  getLowStockEquipment,
  getOutOfStockEquipment,
  getEquipmentCategories,
  // Borrowing
  getBorrowingRecords,
  createBorrowingRecord,
  returnBorrowedEquipment,
  deleteBorrowingRecord,
  getBorrowingStats,
  // Profile
  getProfile,
  updateProfile,
  // Users (Admin)
  getAllUsers,
  getAdminStudents,
  getAdminScreeners,
  createUser,
  deleteUser,
  deleteUsers,
  // Students
  getStudents,
  verifyStudent,
  // Admin Requirements
  createRequirement,
  publishRequirement,
  getAllRequirements,
  getPublishedRequirements,
  updateAdminRequirement,
  deleteAdminRequirement,
  submitRequirementCompletion,
  getMySubmissions,
  getAllSubmissions,
  reviewSubmission,
  // Student Requirements
  uploadRequirement,
  getStudentRequirements,
  deleteRequirement,
  downloadRequirement,
  getStudentStats,
  getAnnouncements,
  // Coach
  getCoachProfile,
  updateCoachProfile,
  getCoachUpdates,
  getCoachAthletes,
  updateCoachAthlete,
  updateAthleteStatus,
  // Schedule Requests
  createScheduleRequest,
  getScheduleRequests,
  getScheduleRequestById,
  updateScheduleRequest,
  deleteScheduleRequest,
  getScheduleRequestsByStatus,
  // Schedules
  getSchedules,
  getSchedulesByDateRange,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule
};



