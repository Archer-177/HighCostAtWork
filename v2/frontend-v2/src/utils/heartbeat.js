/**
 * Heartbeat utility
 * Sends regular heartbeat to server to keep it alive
 */
import { authAPI } from '../api/auth';

let heartbeatInterval = null;

// Send heartbeat every 5 seconds
const startHeartbeat = () => {
  if (heartbeatInterval) return; // Already running

  heartbeatInterval = setInterval(async () => {
    try {
      await authAPI.heartbeat();
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, 5000); // 5 seconds
};

// Stop heartbeat
export const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

// Start immediately
startHeartbeat();

export default { startHeartbeat, stopHeartbeat };
