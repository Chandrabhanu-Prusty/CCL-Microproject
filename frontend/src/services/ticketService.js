/**
 * Ticket API Service
 * Conforms to API_CONTRACT.md
 */

import { apiRequest } from './apiClient';

export async function getTicketById(ticketId) {
  return apiRequest(`/api/tickets/${encodeURIComponent(ticketId)}`);
}
