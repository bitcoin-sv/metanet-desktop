import { invoke } from '@tauri-apps/api/core'

// Tauri commands exposed as async calls
export async function isFocused(): Promise<boolean> {
  return invoke<boolean>('is_focused')
}

export async function onFocusRequested(): Promise<void> {
  return invoke<void>('request_focus')
}

export async function onFocusRelinquished(): Promise<void> {
  return invoke<void>('relinquish_focus')
}

// Export a bundle of all Tauri functions to pass to the UI components
export const tauriFunctions = {
  isFocused,
  onFocusRequested,
  onFocusRelinquished
}
