/**
 * Authentication API
 */
import client from './client';

export const authAPI = {
  /**
   * Login user
   */
  login: async (username, password) => {
    const { data } = await client.post('/login', { username, password });
    return data;
  },

  /**
   * Change password
   */
  changePassword: async (username, oldPassword, newPassword) => {
    const { data } = await client.post('/change_password', {
      username,
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  },

  /**
   * Request password reset code
   */
  forgotPassword: async (username) => {
    const { data } = await client.post('/forgot_password', { username });
    return data;
  },

  /**
   * Reset password with code
   */
  resetPassword: async (username, code, newPassword) => {
    const { data } = await client.post('/reset_password', {
      username,
      code,
      new_password: newPassword,
    });
    return data;
  },

  /**
   * Send heartbeat
   */
  heartbeat: async () => {
    const { data } = await client.post('/heartbeat');
    return data;
  },
};
