import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConstantsService {
  CHAIN_ID = {
    MAINNET: 1,
    RINKEBY: 4,
  };

  CHAIN_NAME = {
    1: 'mainnet',
    4: 'rinkeby',
  };

  MPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x8888801af4d980682e47f1a9036e589479e835c5',
    [this.CHAIN_ID.RINKEBY]: '0xC79a56Af51Ec36738E965e88100e4570c5C77A93',
  };

  // @dev currently points to MPH
  XMPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x8888801af4d980682e47f1a9036e589479e835c5',
    [this.CHAIN_ID.RINKEBY]: '0xC79a56Af51Ec36738E965e88100e4570c5C77A93',
  };

  GRAPHQL_ENDPOINT_ADDRESS = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph', // v2
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-rinkeby', // v3
  };

  RPC = {
    [this.CHAIN_ID.MAINNET]:
      'https://eth-mainnet.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-',
    [this.CHAIN_ID.RINKEBY]:
      'https://eth-rinkeby.alchemyapi.io/v2/2LxgvUYd5FzgiXVoAWlq-KyM4v-E7KJ4',
  };

  RPC_WS = {
    [this.CHAIN_ID.MAINNET]:
      'wss://eth-mainnet.ws.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-',
    [this.CHAIN_ID.RINKEBY]:
      'wss://eth-rinkeby.ws.alchemyapi.io/v2/2LxgvUYd5FzgiXVoAWlq-KyM4v-E7KJ4',
  };

  NETWORK_METADATA = {
    [this.CHAIN_ID.MAINNET]: {
      chainId: '0x1',
      chainName: 'Ethereum',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://mainnet.infura.io/v3'],
      blockExplorerUrls: ['https://etherscan.com'],
    },
    [this.CHAIN_ID.RINKEBY]: {
      chainId: '0x4',
      chainName: 'Rinkeby',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://rinkeby.infura.io/v3'],
      blockExplorerUrls: ['https://rinkeby.etherscan.com'],
    },
  };

  BLOCKNATIVE_KEY = 'af9c0a83-8874-4e07-a272-19c879420693';
  INFURA_KEY = '9e5f0d08ad19483193cc86092b7512f2';
  PORTIS_KEY = 'a838dbd2-c0b1-4465-8dbe-36b88f3d0d4e';
  FORTMATIC_KEY = 'pk_live_937F9430B2CB3407';

  // UTILITIES //
  PRECISION = 1e18;
  YEAR_IN_SEC = 31556952;
  MONTH_IN_SEC = 30 * 24 * 60 * 60;
  WEEK_IN_SEC = 7 * 24 * 60 * 60;
  DAY_IN_SEC = 24 * 60 * 60;
  SUBGRAPH_SYNC_WARNING_THRESHOLD = 20; // if falls behind by 20 blocks, display error banner
  GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph';

  // 88MPH CONTRACTS //
  GOV_TREASURY = '0x56f34826Cc63151f74FA8f701E4f73C5EAae52AD';
  DEV_WALLET = '0xfecBad5D60725EB6fd10f8936e02fa203fd27E4b';
  DUMPER = '0x5B3C81C86d17786255904c316bFCB38A46146ef8';
  MPH_MERKLE_DISTRIBUTOR = '0x8c5ddBB0fd86B6480D81A1a5872a63812099C043'; // the MPH V2 distributor

  // EXTERNAL CONTRACTS //
  COMPOUND_COMPTROLLER = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
  SUSHI_MASTERCHEF = '0xc2edad668740f1aa35e4d8f227fb8e17dca888cd';
  SUSHI_MPH_ONSEN_ID = 92;
  BANCOR_LP_STATS = '0x9712Bb50DC6Efb8a3d7D12cEA500a50967d2d471';
  BANCOR_STAKING_REWARDS = '0x4B90695C2013FC60df1e168c2bCD4Fd12f5C9841';
  BANCOR_STAKING_REWARDS_STORE = '0x891AfF26593Da95e574E3f62619dAD6624FB5693';

  // TOKENS //
  MPH = '0x8888801af4d980682e47f1a9036e589479e835c5';
  XMPH = '0x8888801af4d980682e47f1a9036e589479e835c5'; // @dev update after contract is deployed
  COMP = '0xc00e94cb662c3520282e6f5717214004a7f26888';
  FARM = '0xa0246c9032bC3A600820415aE600c6388619A14D';
  AAVE = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9';
  STKAAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';
  SUSHI = '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2';
  BNT = '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c';
  WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  // LP TOKENS //
  SUSHI_LP = '0xb2c29e311916a346304f83aa44527092d5bd4f0f';
  BANCOR_MPHBNT_POOL = '0xabf26410b1cff45641af087ee939e52e328cee46';
}
