import { OrthancStatus, PACSConfig } from '../types/pacs';

export function isPacsOperational(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): boolean {
  return !!(status?.online && config?.isConfigured);
}

// REST App -> Orthanc (HTTP :8042, GET /system). No implica equipo conectado.
export function isRestOnline(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): boolean {
  return !!(status?.online && config?.isConfigured);
}

// DICOM Equipo -> Orthanc (C-ECHO OK + opcionalmente C-STORE reciente).
export function isDicomVerified(status: OrthancStatus | null | undefined): boolean {
  return !!status?.dicom?.verified;
}

export function connectionLabel(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): 'Connected' | 'Disconnected' | 'NotConfigured' {
  if (!config?.isConfigured) return 'NotConfigured';
  return status?.online ? 'Connected' : 'Disconnected';
}

export function dicomLabel(
  status: OrthancStatus | null | undefined,
  config: PACSConfig | null | undefined,
): 'Verified' | 'NotVerified' | 'NotConfigured' | 'Unreachable' {
  if (!config?.isConfigured) return 'NotConfigured';
  if (!status?.online) return 'Unreachable';
  return status?.dicom?.verified ? 'Verified' : 'NotVerified';
}
