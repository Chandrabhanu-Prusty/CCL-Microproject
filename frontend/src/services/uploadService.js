/**
 * Upload S3 Presigned URL API Service
 * Conforms to API_CONTRACT.md
 */

import { apiRequest } from './apiClient';

export async function getBannerUploadUrl(fileName, contentType) {
  return apiRequest('/api/uploads/banner-url', {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType }),
  });
}
