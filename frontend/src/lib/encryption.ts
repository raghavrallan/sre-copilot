/**
 * Simple encryption utility for localStorage
 * Uses AES-GCM encryption with Web Crypto API
 */

const ENCRYPTION_KEY_NAME = 'sre_copilot_key'
const IV_LENGTH = 12

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  const existingKey = sessionStorage.getItem(ENCRYPTION_KEY_NAME)

  if (existingKey) {
    const keyData = JSON.parse(existingKey)
    return await crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  // Store key in sessionStorage (cleared on browser close)
  const exportedKey = await crypto.subtle.exportKey('jwk', key)
  sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey))

  return key
}

/**
 * Encrypt data before storing in localStorage
 */
export async function encryptData(data: any): Promise<string> {
  try {
    const key = await getEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    const encodedData = new TextEncoder().encode(JSON.stringify(data))

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    )

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedData), iv.length)

    // Convert to base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data from localStorage
 */
export async function decryptData<T>(encryptedString: string): Promise<T> {
  try {
    const key = await getEncryptionKey()

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0))

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH)
    const encryptedData = combined.slice(IV_LENGTH)

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    )

    const decodedData = new TextDecoder().decode(decryptedData)
    return JSON.parse(decodedData)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Securely store data in localStorage with encryption
 */
export async function setSecureItem(key: string, value: any): Promise<void> {
  const encrypted = await encryptData(value)
  localStorage.setItem(key, encrypted)
}

/**
 * Retrieve and decrypt data from localStorage
 */
export async function getSecureItem<T>(key: string): Promise<T | null> {
  const encrypted = localStorage.getItem(key)
  if (!encrypted) return null

  try {
    return await decryptData<T>(encrypted)
  } catch {
    // If decryption fails, remove corrupted data
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Remove item from localStorage
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(key)
}

/**
 * Clear all encrypted storage
 */
export function clearSecureStorage(): void {
  localStorage.clear()
  sessionStorage.removeItem(ENCRYPTION_KEY_NAME)
}
