import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';

@Injectable({
  providedIn: 'root',
})
export class ConstantsService {
  // NETWORK INFO //
  CHAIN_ID = {
    MAINNET: 1,
    RINKEBY: 4,
  };
  CHAIN_ID_STRING = {
    [this.CHAIN_ID.MAINNET]: 'mainnet',
    [this.CHAIN_ID.RINKEBY]: 'rinkeby',
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

  // GRAPHQL ENDPOINTS //
  GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-rinkeby',
  };
  MPH_TOKEN_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/mph-token',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/mph-token-rinkeby',
  };
  BACK_TO_THE_FUTURE_GRAPHQL_ENDPOINT = {
    // used for more accurate historical data
    [this.CHAIN_ID.MAINNET]: '',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/back-to-the-future-rinkeby',
  };
  BLOCKS_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/blocklytics/rinkeby-blocks',
  };
  UNISWAP_V2_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
  UNISWAP_V3_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
  SUSHISWAP_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/sushiswap/exchange';

  // RPC ENDPOINTS //
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

  // API KEYS //
  BLOCKNATIVE_KEY = 'af9c0a83-8874-4e07-a272-19c879420693';
  INFURA_KEY = '9e5f0d08ad19483193cc86092b7512f2';
  PORTIS_KEY = 'a838dbd2-c0b1-4465-8dbe-36b88f3d0d4e';
  FORTMATIC_KEY = 'pk_live_937F9430B2CB3407';
  NFTSTORAGE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGM1NWQxRjE1OEFDY2IwOTFCRTBGNTNkYTZkYTMzYzdmMDJhNzdlNTkiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTYyNzg3MDUwNDI1NSwibmFtZSI6Ijg4bXBoIn0.wwMdT6BQp3cB0DJPWy5qm4uWZLhjY0BPYxsqGiYKHOk';

  // UTILITIES //
  PRECISION = 1e18;
  YEAR_IN_SEC = 31556952;
  MONTH_IN_SEC = 30 * 24 * 60 * 60;
  WEEK_IN_SEC = 7 * 24 * 60 * 60;
  DAY_IN_SEC = 24 * 60 * 60;
  SUBGRAPH_SYNC_WARNING_THRESHOLD = 20; // if falls behind by 20 blocks, display error banner
  TX_CONFIRMATION_REFRESH_WAIT_TIME = 3 * 1e3; // Time between tx confirmation and data refresh, in ms. Should only be used when data is loaded through the subgraph.
  DUST_THRESHOLD = new BigNumber(1e-10).toFixed(10); // The minimum amount below which deposits/fundings won't be displayed

  // 88MPH CONTRACTS //
  DUMPER = '0x8Cc9ADF88fe0b5C739bD936E9edaAd30578f4265';

  GOV_TREASURY = {
    [this.CHAIN_ID.MAINNET]: '0x56f34826Cc63151f74FA8f701E4f73C5EAae52AD',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  DEV_WALLET = {
    [this.CHAIN_ID.MAINNET]: '0xfecBad5D60725EB6fd10f8936e02fa203fd27E4b',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  MERKLE_DISTRIBUTOR = {
    [this.CHAIN_ID.MAINNET]: '0x8c5ddBB0fd86B6480D81A1a5872a63812099C043',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  MPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x8888801af4d980682e47f1a9036e589479e835c5',
    [this.CHAIN_ID.RINKEBY]: '0xC79a56Af51Ec36738E965e88100e4570c5C77A93',
  };
  XMPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x1702F18c1173b791900F81EbaE59B908Da8F689b',
    [this.CHAIN_ID.RINKEBY]: '0x59EE65726f0b886Ec924271B51A3c1e78F52d1FB',
  };

  // EXTERNAL CONTRACTS //
  COMPOUND_COMPTROLLER = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
  SUSHI_MASTERCHEF = '0xc2edad668740f1aa35e4d8f227fb8e17dca888cd';
  SUSHI_MPH_ONSEN_ID = 92;
  BANCOR_LP_STATS = '0x9712Bb50DC6Efb8a3d7D12cEA500a50967d2d471';
  BANCOR_STAKING_REWARDS = '0x4B90695C2013FC60df1e168c2bCD4Fd12f5C9841';
  BANCOR_STAKING_REWARDS_STORE = '0x891AfF26593Da95e574E3f62619dAD6624FB5693';

  SUSHI_MASTERCHEF_V2 = {
    [this.CHAIN_ID.MAINNET]: '0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  SUSHI_MPH_REWARDER = {
    [this.CHAIN_ID.MAINNET]: '0x2889fE6B8cfAE15CC53157b8f0494FdB08721C39',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  SUSHI_MPH_REWARDER_ID = {
    [this.CHAIN_ID.MAINNET]: 4,
    [this.CHAIN_ID.RINKEBY]: null,
  };

  // TOKENS //
  COMP = '0xc00e94cb662c3520282e6f5717214004a7f26888';
  FARM = '0xa0246c9032bC3A600820415aE600c6388619A14D';
  AAVE = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9';
  STKAAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';
  SUSHI = '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2';
  BNT = '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c';
  WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  DAI = {
    [this.CHAIN_ID.MAINNET]: '0x6b175474e89094c44da98b954eedeac495271d0f',
    [this.CHAIN_ID.RINKEBY]: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
  };
  USDC = {
    [this.CHAIN_ID.MAINNET]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    [this.CHAIN_ID.RINKEBY]: '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b',
  };
  SUSD = {
    [this.CHAIN_ID.MAINNET]: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  UNI = {
    [this.CHAIN_ID.MAINNET]: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    [this.CHAIN_ID.RINKEBY]: '',
  };

  // LP TOKENS //
  UNISWAP_V2_LP = {
    [this.CHAIN_ID.MAINNET]: '0x4d96369002fc5b9687ee924d458a7e5baa5df34e',
    [this.CHAIN_ID.RINKEBY]: '0x52768abae4e3f4a714aee3d0f85b4eba6360fda3',
  };
  UNISWAP_V3_LP = {
    [this.CHAIN_ID.MAINNET]: '0xda7dd9ad1b2af1e50c73a0cc5d23ec5397478763',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  SUSHISWAP_LP = {
    [this.CHAIN_ID.MAINNET]: '0xb2c29e311916a346304f83aa44527092d5bd4f0f',
    [this.CHAIN_ID.RINKEBY]: '',
  };
  BANCOR_LP = {
    [this.CHAIN_ID.MAINNET]: '0xdf3fdfbce72da4fd42e7cfde7249e15357c7d808',
    [this.CHAIN_ID.RINKEBY]: '',
  };

  SUSHI_LP = '0xb2c29e311916a346304f83aa44527092d5bd4f0f';
  BANCOR_MPHBNT_POOL = '0xabf26410b1cff45641af087ee939e52e328cee46';
}
