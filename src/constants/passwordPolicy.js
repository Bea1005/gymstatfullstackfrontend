export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

export const isPasswordValid = (password) => (
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_-]).{8,}$/.test(String(password || ''))
);
