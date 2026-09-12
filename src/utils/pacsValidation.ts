import { OrthancStatus, PACSConfig } from '../types/pacs';

export function isPacsOperational(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): boolean {
  return !!(status?.online && config?.isConfigured);
}

export function connectionLabel(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): 'Connected' | 'Disconnected' | 'NotConfigured' {
  if (!config?.isConfigured) return 'NotConfigured';
  return status?.online ? 'Connected' : 'Disconnected';
}
