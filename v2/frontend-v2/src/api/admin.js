/**
 * Admin API
 */
import client from './client';

export const adminAPI = {
  // ========== USERS ==========
  getUsers: async () => {
    const { data } = await client.get('/users');
    return data;
  },

  createUser: async (userData) => {
    const { data } = await client.post('/users', userData);
    return data;
  },

  updateUser: async (userId, updates) => {
    const { data } = await client.put(`/users/${userId}`, updates);
    return data;
  },

  deleteUser: async (userId) => {
    const { data } = await client.delete(`/users/${userId}`);
    return data;
  },

  // ========== DRUGS ==========
  getDrugs: async () => {
    const { data } = await client.get('/drugs');
    return data;
  },

  createDrug: async (drugData) => {
    const { data } = await client.post('/drugs', drugData);
    return data;
  },

  updateDrug: async (drugId, updates) => {
    const { data } = await client.put(`/drugs/${drugId}`, updates);
    return data;
  },

  deleteDrug: async (drugId) => {
    const { data } = await client.delete(`/drugs/${drugId}`);
    return data;
  },

  // ========== LOCATIONS ==========
  getLocations: async () => {
    const { data } = await client.get('/locations');
    return data;
  },

  createLocation: async (locationData) => {
    const { data } = await client.post('/locations', locationData);
    return data;
  },

  updateLocation: async (locationId, updates) => {
    const { data } = await client.put(`/locations/${locationId}`, updates);
    return data;
  },

  deleteLocation: async (locationId) => {
    const { data } = await client.delete(`/locations/${locationId}`);
    return data;
  },

  // ========== STOCK LEVELS ==========
  getStockLevels: async () => {
    const { data } = await client.get('/stock_levels');
    return data;
  },

  updateStockLevels: async (updates) => {
    const { data } = await client.put('/stock_levels', { updates });
    return data;
  },

  // ========== SETTINGS ==========
  getSettings: async (locationId) => {
    const { data } = await client.get(`/settings/${locationId}`);
    return data;
  },

  updateSettings: async (locationId, settings) => {
    const { data } = await client.put(`/settings/${locationId}`, settings);
    return data;
  },
};
