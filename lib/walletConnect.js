// WalletConnect v2 integration for VaultQuokka
// Supports 100+ wallets via QR code and deep links

const PROJECT_ID = '699bd582941464fa34e3072208dd8203'

let provider = null

/**
 * Get or create the WalletConnect EthereumProvider.
 * Lazy-loaded so it doesn't bloat initial page load.
 */
async function getProvider() {
  if (provider) return provider

  const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider')

  provider = await EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [1],              // Ethereum mainnet
    optionalChains: [56, 137, 42161, 10, 8453, 43114, 137, 324], // BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, zkSync
    showQrModal: true,
    methods: ['personal_sign', 'eth_sendTransaction', 'eth_signTypedData_v4'],
    events: ['chainChanged', 'accountsChanged'],
  })

  return provider
}

/**
 * Connect wallet — opens the WalletConnect QR modal.
 * Returns the connected address, or null if cancelled.
 */
export async function connectWallet() {
  // If browser has a native wallet extension (MetaMask, etc.), prefer it
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts && accounts.length > 0) {
        return { address: accounts[0], provider: window.ethereum }
      }
    } catch {
      // Extension rejected — fall through to WalletConnect
    }
  }

  // Otherwise use WalletConnect modal (QR code / deep links)
  const wc = await getProvider()
  try {
    await wc.enable()
    const accounts = wc.accounts
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet')
    }
    return { address: accounts[0], provider: wc }
  } catch (err) {
    // User cancelled or error
    throw err
  }
}

/**
 * Sign a message with the connected wallet.
 * Works with both injected wallets and WalletConnect.
 */
export async function signMessage(message, provider) {
  if (!provider) throw new Error('No wallet connected')

  const accounts = await provider.request({ method: 'eth_accounts' })
  const address = accounts[0]

  const signature = await provider.request({
    method: 'personal_sign',
    params: [message, address],
  })

  return { address, signature }
}

/**
 * Disconnect the WalletConnect session.
 */
export async function disconnectWallet() {
  if (provider) {
    try {
      await provider.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    provider = null
  }
}
