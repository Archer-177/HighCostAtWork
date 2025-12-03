/**
 * Transfer API
 */
import client from './client';

export const transferAPI = {
  /**
   * Create transfer
   */
  createTransfer: async (fromLocationId, toLocationId, vialIds, createdBy) => {
    const { data } = await client.post('/create_transfer', {
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      vial_ids: vialIds,
      created_by: createdBy,
    });
    return data;
  },

  /**
   * Approve transfer
   */
  approveTransfer: async (transferId, userId, version) => {
    const { data } = await client.post(`/transfer/${transferId}/approve`, {
      user_id: userId,
      version,
    });
    return data;
  },

  /**
   * Complete transfer
   */
  completeTransfer: async (transferId, userId, version) => {
    const { data } = await client.post(`/transfer/${transferId}/complete`, {
      user_id: userId,
      version,
    });
    return data;
  },

  /**
   * Cancel transfer
   */
  cancelTransfer: async (transferId, userId, version) => {
    const { data} = await client.post(`/transfer/${transferId}/cancel`, {
      user_id: userId,
      version,
    });
    return data;
  },

  /**
   * Get transfers for location
   */
  getTransfers: async (locationId) => {
    const { data } = await client.get(`/transfers/${locationId}`);
    return data;
  },
};
