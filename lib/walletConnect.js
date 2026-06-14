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
    optionalChains: [56, 137, 42161, 10, 8453, 43114, 324],
    showQrModal: true,
    methods: ['personal_sign', 'eth_sendTransaction', 'eth_signTypedData_v4'],
    events: ['chainChanged', 'accountsChanged'],
    rpcMap: {},
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

    // CRITICAL: Force provider.chainId to a chain the wallet actually approved
    const sessionChains = wc.session?.namespaces?.eip155?.chains || []
    console.log('[walletConnect] session chains:', sessionChains)
    console.log('[walletConnect] provider.chainId after connect:', wc.chainId)
    // Pick best chain: prefer mainnet if available, else first approved chain
    let resolvedChainId = wc.chainId
    if (sessionChains.length > 0) {
      const mainnetChain = sessionChains.find(c => c === 'eip155:1')
      const preferredChain = mainnetChain || sessionChains[0]
      resolvedChainId = parseInt(preferredChain.split(':')[1], 10)
      console.log('[walletConnect] resolved chain:', preferredChain, '→', resolvedChainId)
    }
    if (!resolvedChainId) resolvedChainId = 56
    // Directly set chainId on provider (setDefaultChain ignored when chains:[1] in init)
    if (wc.chainId !== resolvedChainId) {
      console.log('[walletConnect] forcing provider.chainId from', wc.chainId, 'to', resolvedChainId)
      wc.chainId = resolvedChainId
      wc.signer && (wc.signer.chainId = resolvedChainId)
      console.log('[walletConnect] provider.chainId after force:', wc.chainId)
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

  // Hex-encode message (personal_sign standard)
  const toHex = (str) => '0x' + Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  const hexMessage = toHex(message)
  console.log('[walletConnect] message hex length:', hexMessage.length)

  const isWalletConnect = !!provider.session
  console.log('[walletConnect] isWalletConnect:', isWalletConnect)
  console.log('[walletConnect] provider.chainId before signing:', provider.chainId)

  // Ensure the provider chainId matches an approved session chain before signing
  if (isWalletConnect) {
    const sessionChains = provider.session?.namespaces?.eip155?.chains || []
    console.log('[walletConnect] session chains:', sessionChains)
    if (sessionChains.length > 0) {
      const mainnetChain = sessionChains.find(c => c === 'eip155:1')
      const preferredChain = mainnetChain || sessionChains[0]
      const chainNum = parseInt(preferredChain.split(':')[1], 10)
      if (provider.chainId !== chainNum) {
        console.log('[walletConnect] forcing chainId to', chainNum, 'before signing')
        provider.chainId = chainNum
        provider.signer && (provider.signer.chainId = chainNum)
      }
    }
    console.log('[walletConnect] provider.chainId after fix:', provider.chainId)
  }

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

// USDT contract addresses per chain
const USDT_CONTRACTS = {
  1:   '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Ethereum mainnet
  56:  '0x55d398326f99059fF775485246999027B3197955', // BSC
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Polygon
}

// ERC-20 transfer(address,uint256) function selector
const ERC20_TRANSFER_SELECTOR = '0xa9059cbb'

/**
 * One-tap USDT deposit via WalletConnect.
 * Sends USDT from user's wallet to VaultQuokka's deposit address.
 * Returns the transaction hash.
 */
export async function walletDeposit({ provider, fromAddress, toAddress, usdtAmount }) {
  console.log('[walletConnect] walletDeposit() called', { fromAddress, toAddress, usdtAmount })

  if (!provider) throw new Error('No wallet connected')
  if (!toAddress) throw new Error('No deposit address configured')
  if (!usdtAmount || usdtAmount <= 0) throw new Error('Invalid amount')
  if (usdtAmount > 50000) throw new Error('Maximum deposit is $50,000 USDT')

  // Ensure chainId is set to an approved session chain
  const isWalletConnect = !!provider.session
  let chainId = provider.chainId || 56
  if (isWalletConnect) {
    const sessionChains = provider.session?.namespaces?.eip155?.chains || []
    if (sessionChains.length > 0) {
      const bscChain = sessionChains.find(c => c === 'eip155:56')
      const mainnetChain = sessionChains.find(c => c === 'eip155:1')
      const preferred = bscChain || mainnetChain || sessionChains[0]
      chainId = parseInt(preferred.split(':')[1], 10)
      if (provider.chainId !== chainId) {
        provider.chainId = chainId
        provider.signer && (provider.signer.chainId = chainId)
      }
    }
  }
  console.log('[walletConnect] walletDeposit using chainId:', chainId)

  const contractAddress = USDT_CONTRACTS[chainId]
  if (!contractAddress) {
    throw new Error(`USDT deposits not supported on chain ${chainId}. Please use BSC, Ethereum, or Polygon.`)
  }

  // USDT has 6 decimals (not 18)
  const decimals = 6
  const amountInSmallestUnit = BigInt(Math.round(usdtAmount * 10 ** decimals))

  // Encode transfer(address,uint256) calldata
  const paddedTo = toAddress.toLowerCase().replace('0x', '').padStart(64, '0')
  const paddedAmount = amountInSmallestUnit.toString(16).padStart(64, '0')
  const data = ERC20_TRANSFER_SELECTOR + paddedTo + paddedAmount

  console.log('[walletConnect] sending USDT transfer tx:', { contractAddress, data: data.slice(0, 20) + '...' })

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: fromAddress,
      to: contractAddress,
      data,
      value: '0x0',
    }],
  })

  console.log('[walletConnect] walletDeposit tx hash:', txHash)
  return { txHash, chainId, contractAddress, amount: usdtAmount }
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
