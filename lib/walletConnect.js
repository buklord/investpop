// WalletConnect v2 integration for VaultQuokka
// Supports 100+ wallets via QR code and deep links

const PROJECT_ID = '699bd582941464fa34e3072208dd8203'

let provider = null

/**
 * Get or create the WalletConnect EthereumProvider.
 * Lazy-loaded so it doesn't bloat initial page load.
 */
async function getProvider() {
  console.log('[walletConnect] getProvider() called')
  if (provider) {
    console.log('[walletConnect] returning cached provider')
    return provider
  }

  console.log('[walletConnect] importing @walletconnect/ethereum-provider...')
  const wcModule = await import('@walletconnect/ethereum-provider')
  console.log('[walletConnect] imported module keys:', Object.keys(wcModule))

  // Try named export first, fallback to default
  const EthereumProvider = wcModule.EthereumProvider || wcModule.default
  if (!EthereumProvider) {
    throw new Error('EthereumProvider not found. Available: ' + Object.keys(wcModule).join(', '))
  }
  console.log('[walletConnect] EthereumProvider found, calling init...')

  provider = await EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [1],
    optionalChains: [56, 137, 42161, 10, 8453, 43114, 137, 324],
    showQrModal: true,
    methods: ['personal_sign', 'eth_sendTransaction', 'eth_signTypedData_v4'],
    events: ['chainChanged', 'accountsChanged'],
  })
  console.log('[walletConnect] provider initialized')

  return provider
}

/**
 * Connect wallet — opens the WalletConnect QR modal.
 * Returns the connected address, or null if cancelled.
 */
export async function connectWallet() {
  console.log('[walletConnect] connectWallet() called')

  // If browser has a native wallet extension (MetaMask, etc.), prefer it
  if (typeof window !== 'undefined' && window.ethereum) {
    console.log('[walletConnect] found window.ethereum, trying injected wallet...')
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts && accounts.length > 0) {
        console.log('[walletConnect] injected wallet connected:', accounts[0])
        return { address: accounts[0], provider: window.ethereum }
      }
    } catch (extErr) {
      console.log('[walletConnect] injected wallet rejected:', extErr?.message || extErr)
    }
  } else {
    console.log('[walletConnect] no window.ethereum, will use WalletConnect modal')
  }

  // Otherwise use WalletConnect modal (QR code / deep links)
  console.log('[walletConnect] initializing WalletConnect provider...')
  const wc = await getProvider()
  console.log('[walletConnect] provider ready, calling connect()...')

  try {
    await wc.connect()
    console.log('[walletConnect] connect() succeeded')

    // CRITICAL: Ensure provider.chainId is set after connect
    // WalletConnect v2 EthereumProvider needs chainId to be non-zero for request() to work
    console.log('[walletConnect] provider.chainId after connect:', wc.chainId)
    const sessionChains = wc.session?.namespaces?.eip155?.chains || []
    console.log('[walletConnect] session chains:', sessionChains)
    // Extract numeric chainId from session (e.g. 'eip155:1' → 1)
    let resolvedChainId = wc.chainId
    if (!resolvedChainId && sessionChains.length > 0) {
      resolvedChainId = parseInt(sessionChains[0].split(':')[1], 10)
      console.log('[walletConnect] resolved chainId from session:', resolvedChainId)
    }
    if (!resolvedChainId) resolvedChainId = 1
    // Set it on the provider so request() uses the right chain
    if (wc.setDefaultChain) {
      console.log('[walletConnect] calling setDefaultChain with:', resolvedChainId)
      wc.setDefaultChain(resolvedChainId)
      console.log('[walletConnect] provider.chainId after setDefaultChain:', wc.chainId)
    }

    // WalletConnect v2: accounts may be in session.namespaces.eip155.accounts (CAIP-10 format)
    let accounts = wc.accounts || []
    console.log('[walletConnect] wc.accounts:', accounts)

    if (!accounts || accounts.length === 0) {
      const sessionAccounts = wc.session?.namespaces?.eip155?.accounts || []
      console.log('[walletConnect] session.accounts (CAIP-10):', sessionAccounts)
      // CAIP-10 format: eip155:1:0xAddress → extract just the address
      accounts = sessionAccounts.map(a => a.split(':').pop())
      console.log('[walletConnect] extracted addresses:', accounts)
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet')
    }
    return { address: accounts[0], provider: wc }
  } catch (err) {
    console.error('[walletConnect] connection failed:', err?.message || err, err)
    throw err
  }
}

/**
 * Sign a message with the connected wallet.
 * Works with both injected wallets and WalletConnect.
 */
export async function signMessage(message, provider) {
  console.log('[walletConnect] signMessage() called')
  if (!provider) throw new Error('No wallet connected')

  const accounts = await provider.request({ method: 'eth_accounts' })
  const address = accounts[0]
  console.log('[walletConnect] signing for address:', address)

  // Hex-encode message for WalletConnect compatibility (personal_sign expects hex string)
  // Browser-safe: no Buffer dependency
  const toHex = (str) => '0x' + Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  const hexMessage = toHex(message)
  console.log('[walletConnect] hex-encoded message length:', hexMessage.length)

  console.log('[walletConnect] provider.chainId before signing:', provider.chainId)
  let signature
  try {
    console.log('[walletConnect] calling personal_sign...')
    signature = await provider.request({
      method: 'personal_sign',
      params: [hexMessage, address],
    })
    console.log('[walletConnect] personal_sign succeeded')
  } catch (err) {
    console.error('[walletConnect] personal_sign failed:', err?.message || err)
    throw err
  }

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
