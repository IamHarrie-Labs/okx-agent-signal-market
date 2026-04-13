/**
 * Deploy SignalRegistry to X Layer mainnet.
 * Run: node --loader ts-node/esm src/contracts/deploy.ts
 */
import 'dotenv/config';
import { createWalletClient, createPublicClient, http, defineChain, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const RPC = process.env.XLAYER_RPC_URL ?? 'https://rpc.xlayer.tech';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('AGENT_PRIVATE_KEY not set in .env'); process.exit(1); }

const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' } },
});

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: xlayer, transport: http(RPC) });
const publicClient = createPublicClient({ chain: xlayer, transport: http(RPC) });

async function compile(): Promise<{ bytecode: `0x${string}`; abi: unknown[] }> {
  console.log('   Compiling SignalRegistry.sol...');

  const solc = require('solc');
  const contractPath = resolve('src/contracts/SignalRegistry.sol');
  const source = readFileSync(contractPath, 'utf8');

  const input = JSON.stringify({
    language: 'Solidity',
    sources: { 'SignalRegistry.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
    },
  });

  const output = JSON.parse(solc.compile(input));

  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:\n', errors.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'));
    process.exit(1);
  }

  const contract = output.contracts['SignalRegistry.sol']['SignalRegistry'];
  const bytecode = ('0x' + contract.evm.bytecode.object) as `0x${string}`;
  const abi = contract.abi;

  console.log(`   ✅ Compiled (${(bytecode.length / 2 - 1)} bytes)`);
  return { bytecode, abi };
}

async function main() {
  console.log('\n🚀 Deploying SignalRegistry to X Layer mainnet');
  console.log(`   RPC:      ${RPC}`);
  console.log(`   Deployer: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Balance:  ${formatEther(balance)} OKB`);

  if (balance === 0n) {
    console.error('\n❌ No OKB balance. Bridge some OKB to this address first:');
    console.error(`   ${account.address}`);
    console.error('   Bridge: https://www.okx.com/xlayer/bridge');
    process.exit(1);
  }

  const { bytecode, abi } = await compile();

  console.log('   Broadcasting deployment...');
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [],
  });

  console.log(`   Tx hash: ${hash}`);
  console.log('   Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress!;

  console.log(`\n✅ Deployed!`);
  console.log(`   Contract address: ${contractAddress}`);
  console.log(`   Explorer:         https://www.oklink.com/xlayer/tx/${hash}`);

  // Write contract address to .env automatically
  const envPath = resolve('.env');
  let env = readFileSync(envPath, 'utf8');
  env = env.replace(/SIGNAL_REGISTRY_ADDRESS=.*/, `SIGNAL_REGISTRY_ADDRESS=${contractAddress}`);
  writeFileSync(envPath, env);
  console.log(`   ✅ SIGNAL_REGISTRY_ADDRESS saved to .env`);

  // Save ABI for reference
  writeFileSync(resolve('src/contracts/SignalRegistry.abi.json'), JSON.stringify(abi, null, 2));
  console.log(`   ✅ ABI saved to src/contracts/SignalRegistry.abi.json`);

  console.log(`\n   Next step: npm run demo:publish`);
}

main().catch(err => {
  console.error('\n❌ Deploy failed:', err.message);
  process.exit(1);
});
