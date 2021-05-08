import Web3 from 'web3';
import Notify from 'bnc-notify';
import Onboard from 'bnc-onboard';
import BigNumber from 'bignumber.js';

export class Web3Enabled {
  blocknativeAPIKey: string;
  infuraKey: string;
  portisAPIKey: string;
  fortmaticKey: string;
  assistInstance: any;
  notifyInstance: any;
  state: any;
  networkID: number;
  alchemyEndpoint: string;
  alchemyWSEndpoint: string;

  constructor(public web3: Web3) {
    this.blocknativeAPIKey = 'af9c0a83-8874-4e07-a272-19c879420693';
    this.infuraKey = '9e5f0d08ad19483193cc86092b7512f2';
    this.portisAPIKey = 'a838dbd2-c0b1-4465-8dbe-36b88f3d0d4e';
    this.fortmaticKey = 'pk_live_937F9430B2CB3407';
    this.alchemyEndpoint = 'https://eth-mainnet.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-';
    this.alchemyWSEndpoint = 'wss://eth-mainnet.ws.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-';
    this.networkID = 1;
    this.state = {
      address: null,
      wallet: {
        provider: null
      }
    };
  }

  async connect(onConnected, onError, isStartupMode: boolean) {
    if (!this.assistInstance) {
      const genericMobileWalletConfig = {
        name: 'Web3 wallet (Metamask)',
        mobile: true,
        desktop: true,
        preferred: true,
        type: 'injected' as 'injected',
        iconSrc: 'data:image/png;base64,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',
        wallet(helpers) {
          const getProviderName = helpers.getProviderName, createModernProviderInterface = helpers.createModernProviderInterface, createLegacyProviderInterface = helpers.createLegacyProviderInterface;
          const provider = window['ethereum'] ||
            (this.web3 && this.web3.currentProvider);
          const result = {
            provider,
            interface: provider
              ? typeof provider.enable === 'function'
                ? createModernProviderInterface(provider)
                : createLegacyProviderInterface(provider)
              : null
          };
          return new Promise<{ provider, interface }>((resolve, reject) => {
            resolve(result);
          });
        }
      };

      const wallets = [
        genericMobileWalletConfig,
        {
          walletName: 'walletConnect',
          rpc: {
            [this.networkID]: this.alchemyEndpoint
          },
          networkId: this.networkID,
          preferred: true
        },
        {
          walletName: 'ledger',
          rpcUrl: this.alchemyEndpoint,
          preferred: true
        },
        {
          walletName: 'trezor',
          appUrl: 'https://88mph.app',
          email: 'hello@88mph.app',
          rpcUrl: this.alchemyEndpoint,
          preferred: true
        },
        {
          walletName: 'walletLink',
          rpcUrl: this.alchemyEndpoint,
          appName: '88mph',
          appLogoUrl: 'https://88mph.app/docs/img/88mph-logo-dark.png'
        },
        {
          walletName: 'fortmatic',
          apiKey: this.fortmaticKey,
          networkId: this.networkID
        },
        {
          walletName: 'torus'
        },
        {
          walletName: 'portis',
          apiKey: this.portisAPIKey,
          networkId: this.networkID
        },
      ];

      const walletChecks = [
        { checkName: 'derivationPath' },
        { checkName: 'connect' },
        { checkName: 'accounts' },
        { checkName: 'network' },
      ];

      const walletSelectConfig = {
        heading: 'Select a Wallet',
        description: 'Please select a wallet to connect to 88mph:',
        wallets
      };

      const bncAssistConfig = {
        dappId: this.blocknativeAPIKey,
        darkMode: true,
        networkId: this.networkID,
        hideBranding: true,
        subscriptions: {
          wallet: wallet => {
            if (wallet.provider) {
              this.web3 = new Web3(wallet.provider);
            }
            // store the selected wallet name to be retrieved next time the app loads
            window.localStorage.setItem('selectedWallet', wallet.name);
          },
          address: this.doNothing,
          network: this.doNothing,
          balance: this.doNothing
        },
        walletSelect: walletSelectConfig,
        walletCheck: walletChecks
      };
      this.assistInstance = Onboard(bncAssistConfig);
    }

    // Get user to select a wallet
    let selectedWallet;
    if (isStartupMode) {
      // Startup mode: connect to previously used wallet if available
      // get the selectedWallet value from local storage
      const previouslySelectedWallet = window.localStorage.getItem('selectedWallet');
      // call wallet select with that value if it exists
      if (previouslySelectedWallet != null) {
        selectedWallet = await this.assistInstance.walletSelect(previouslySelectedWallet);
      }
    } else {
      // Non startup mode: open wallet selection screen
      selectedWallet = await this.assistInstance.walletSelect();
    }
    const state = this.assistInstance.getState();
    if (
      selectedWallet
      || state.address !== null // If user already logged in but want to switch account, and then dismissed window
    ) {
      // Get users' wallet ready to transact
      const ready = await this.assistInstance.walletCheck();
      this.state = this.assistInstance.getState();

      if (!ready) {
        // Selected an option but then dismissed it
        // Treat as no wallet
        onError();
      } else {
        // Successfully connected
        onConnected();
      }
    } else {
      // User refuses to connect to wallet
      // Update state
      this.state = this.assistInstance.getState();
      onError();
    }

    if (!this.notifyInstance) {
      this.notifyInstance = Notify({
        dappId: this.blocknativeAPIKey,
        networkId: this.networkID
      });
      this.notifyInstance.config({
        darkMode: true
      });
    }
  }

  readonlyWeb3() {
    if (this.state.wallet.provider) {
      return this.web3;
    }
    return new Web3(this.alchemyWSEndpoint);
  }

  async estimateGas(func, val, _onError) {
    return Math.floor((await func.estimateGas({
      from: this.state.address,
      value: val
    }).catch(_onError)) * 1.2);
  }

  async sendTx(func, _onTxHash, _onReceipt, _onError) {
    const gasLimit = await this.estimateGas(func, 0, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.address,
        gas: gasLimit,
      }).on('transactionHash', (hash) => {
        _onTxHash(hash);
        const { emitter } = this.notifyInstance.hash(hash);
        // emitter.on('txConfirmed', _onReceipt);
        emitter.on('txFailed', _onError);
      })
        .on('receipt', _onReceipt)
        .on('error', (e) => {
          if (!e.toString().contains('newBlockHeaders')) {
            _onError(e);
          }
        });
    }
  }

  async sendTxWithValue(func, val, _onTxHash, _onReceipt, _onError) {
    const gasLimit = await this.estimateGas(func, val, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.address,
        gas: gasLimit,
        value: val
      }).on('transactionHash', (hash) => {
        _onTxHash(hash);
        const { emitter } = this.notifyInstance.hash(hash);
        // emitter.on('txConfirmed', _onReceipt);
        emitter.on('txFailed', _onError);
      })
        .on('receipt', _onReceipt)
        .on('error', (e) => {
          if (!e.toString().contains('newBlockHeaders')) {
            _onError(e);
          }
        });
    }
  }

  async sendTxWithToken(func, token, to, amount, _onTxHash, _onReceipt, _onError) {
    const maxAllowance = new BigNumber(2).pow(256).minus(1).integerValue().toFixed();
    const allowance = new BigNumber(await token.methods.allowance(this.state.address, to).call());
    if (allowance.gte(amount)) {
      return this.sendTx(func, _onTxHash, _onReceipt, _onError);
    }
    return this.sendTx(token.methods.approve(to, maxAllowance), this.doNothing, () => {
      this.sendTx(func, _onTxHash, _onReceipt, _onError);
    }, _onError);
  }

  async approveToken(token, to, amount, _onTxHash, _onReceipt, _onError) {
    const maxAllowance = new BigNumber(2).pow(256).minus(1).integerValue().toFixed();
    const allowance = new BigNumber(await token.methods.allowance(this.state.address, to).call());
    if (allowance.gte(amount)) {
      _onReceipt();
      return;
    }
    return this.sendTx(token.methods.approve(to, maxAllowance), _onTxHash, _onReceipt, _onError);
  }

  displayGenericError(error: Error) {
    let errorMessage;
    try {
      errorMessage = JSON.parse(error.message.slice(error.message.indexOf('{'))).originalError.message;
    } catch (err) {
      errorMessage = error.message;
    }
    this.notifyInstance.notification({
      eventCode: 'genericError',
      type: 'error',
      message: errorMessage
    });
  }

  doNothing() { }
}
