import Web3 from 'web3';
import Notify from 'bnc-notify';
import BigNumber from 'bignumber.js';
import WalletConnectProvider from '@walletconnect/web3-provider';

const Web3Modal = window['Web3Modal'].default;

export class Web3Enabled {
  blocknativeAPIKey: string;
  infuraKey: string;
  portisAPIKey: string;
  squarelinkKey: string;
  fortmaticKey: string;
  notifyInstance: any;
  web3Modal: any;
  web3Provider: any;
  networkID: number;
  userAddress: string;

  constructor(public web3: Web3) {
    this.blocknativeAPIKey = 'af9c0a83-8874-4e07-a272-19c879420693';
    this.infuraKey = '9e5f0d08ad19483193cc86092b7512f2';
    this.portisAPIKey = 'a838dbd2-c0b1-4465-8dbe-36b88f3d0d4e';
    this.squarelinkKey = '564b947e352529c618f0';
    this.fortmaticKey = 'pk_live_937F9430B2CB3407';
    this.networkID = 1;
  }

  async connect(onConnected, onError, isStartupMode: boolean) {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: this.infuraKey
        }
      }
    };

    if (!this.web3Modal) {
      this.web3Modal = new Web3Modal({
        network: "mainnet",
        cacheProvider: true,
        theme: "dark",
        providerOptions
      });
    }

    if (isStartupMode) {
      // Only connect cached provider
      if (this.web3Modal.cachedProvider) {
        this.web3Provider = await this.web3Modal.connect();
      }
    } else {
      // Clear cached provider and connect
      this.web3Modal.clearCachedProvider();
      this.web3Provider = await this.web3Modal.connect();
    }
    this.web3 = new Web3(this.web3Provider);

    if (this.web3Provider) {
      const accounts = await this.web3.eth.getAccounts();
      this.userAddress = accounts[0];
      onConnected();

      // Subscribe to accounts change
      this.web3Provider.on("accountsChanged", (accounts: string[]) => {
        this.userAddress = accounts[0];
        onConnected();
      });

      // Subscribe to chainId change
      this.web3Provider.on("chainChanged", (chainId: number) => {
        onConnected();
      });

      // Subscribe to provider disconnection
      this.web3Provider.on("disconnect", (error: { code: number; message: string }) => {
        onError();
      });
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
    if (this.web3Provider) {
      return this.web3;
    }
    const endpointURL = `wss://mainnet.infura.io/ws/v3/${this.infuraKey}`;
    return new Web3(endpointURL);
  }

  async estimateGas(func, val, _onError) {
    return Math.floor((await func.estimateGas({
      from: this.userAddress,
      value: val
    }).catch(_onError)) * 1.2);
  }

  async sendTx(func, _onTxHash, _onReceipt, _onError) {
    const gasLimit = await this.estimateGas(func, 0, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.userAddress,
        gas: gasLimit,
      }).on('transactionHash', (hash) => {
        _onTxHash(hash);
        const { emitter } = this.notifyInstance.hash(hash);
        emitter.on('txConfirmed', _onReceipt);
        emitter.on('txFailed', _onError);
      }).on('error', (e) => {
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
        from: this.userAddress,
        gas: gasLimit,
        value: val
      }).on('transactionHash', (hash) => {
        _onTxHash(hash);
        const { emitter } = this.notifyInstance.hash(hash);
        emitter.on('txConfirmed', _onReceipt);
        emitter.on('txFailed', _onError);
      }).on('error', (e) => {
        if (!e.toString().contains('newBlockHeaders')) {
          _onError(e);
        }
      });
    }
  }

  async sendTxWithToken(func, token, to, amount, _onTxHash, _onReceipt, _onError) {
    const maxAllowance = new BigNumber(2).pow(256).minus(1).integerValue().toFixed();
    const allowance = new BigNumber(await token.methods.allowance(this.userAddress, to).call());
    if (allowance.gte(amount)) {
      return this.sendTx(func, _onTxHash, _onReceipt, _onError);
    }
    return this.sendTx(token.methods.approve(to, maxAllowance), this.doNothing, () => {
      this.sendTx(func, _onTxHash, _onReceipt, _onError);
    }, _onError);
  }

  displayGenericError(error: Error) {
    this.notifyInstance.notification({
      eventCode: 'genericError',
      type: 'error',
      message: error.message
    });
  }

  doNothing() { }
}
