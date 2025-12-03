/**
 * Stock API
 */
import client from './client';

export const stockAPI = {
  /**
   * Get dashboard data
   */
  getDashboard: async (userId) => {
    const { data } = await client.get(`/dashboard/${userId}`);
    return data;
  },

  /**
   * Receive stock from supplier
   */
  receiveStock: async (stockData) => {
    const { data } = await client.post('/receive_stock', stockData);
    return data;
  },

  /**
   * Use stock (clinical)
   */
  useStock: async (vialId, userId, version, patientMRN, clinicalNotes) => {
    const { data } = await client.post('/use_stock', {
      vial_id: vialId,
      user_id: userId,
      version,
      patient_mrn: patientMRN,
      clinical_notes: clinicalNotes,
    });
    return data;
  },

  /**
   * Discard stock
   */
  discardStock: async (vialId, userId, version, discardReason, disposalRegisterNumber) => {
    const { data } = await client.post('/discard_stock', {
      vial_id: vialId,
      user_id: userId,
      version,
      discard_reason: discardReason,
      disposal_register_number: disposalRegisterNumber,
    });
    return data;
  },

  /**
   * Search stock
   */
  searchStock: async (filters) => {
    const { data } = await client.get('/stock_search', { params: filters });
    return data;
  },

  /**
   * Get stock journey
   */
  getStockJourney: async (assetId) => {
    const { data } = await client.get(`/stock_journey/${assetId}`);
    return data;
  },
};
