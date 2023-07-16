import { useEffect, useState } from "react";
import deployedContracts from "../generated/deployedContracts";
import { BigNumber, Contract, ethers } from "ethers";
import type { NextPage } from "next";
import toast from "react-hot-toast";
import { useNetwork } from "wagmi";
import { Provider, Wallet, utils } from "zksync-web3";
import { MetaHeader } from "~~/components/MetaHeader";
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const [l1Provider, setL1Provider] = useState<any>();
  const [wallet, setWallet] = useState<any>();
  const [govContract, setGovContract] = useState<any>();
  const [l2Provider, setL2Provider] = useState<any>();
  const [zkSyncAddress, setZkSyncAddress] = useState<any>();
  const [zkSyncContract, setZkSyncContract] = useState<any>();
  const [counterInterface, setCounterInterface] = useState<any>();

  const { chains, chain } = useNetwork();

  const PRIVATE_KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY as string;
  const GOVERNANCE_ADDRESS = deployedContracts[5][0].contracts.Governance.address;
  const GOVERNANCE_ABI = deployedContracts[5][0].contracts.Governance.abi;
  const COUNTER_ABI = deployedContracts[280][0].contracts.Counter.abi;
  const COUNTER_ADDRESS = deployedContracts[280][0].contracts.Counter.address;

  const { data: totalCounter } = useScaffoldContractRead({
    contractName: "Counter",
    functionName: "value",
  });
  console.log(`n-🔴 => totalCounter:`, totalCounter?.toString());

  const onIncrement = async () => {
    toast.success("submited to l2 form l1");
    const data: any = counterInterface.encodeFunctionData("increment", []);
    // The price of an L1 transaction depends on the gas price used.
    // You should explicitly fetch the gas price before making the call.
    const gasPrice = await l1Provider.getGasPrice();
    // Define a constant for gas limit which estimates the limit for the L1 to L2 transaction.
    const gasLimit = await l2Provider.estimateL1ToL2Execute({
      contractAddress: COUNTER_ADDRESS,
      calldata: data,
      caller: utils.applyL1ToL2Alias(GOVERNANCE_ADDRESS),
    });
    console.log(`n-🔴 => main => gasLimit:`, gasLimit.toString());
    // baseCost takes the price and limit and formats the total in wei.
    // For more information on `REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT` see the [fee model documentation](../../reference/concepts/fee-model.md).
    const baseCost = await zkSyncContract.l2TransactionBaseCost(
      gasPrice,
      gasLimit,
      utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    );
    console.log(`n-🔴 => main => baseCost:`, ethers.utils.formatEther(baseCost.toString()));
    // !! If you don't include the gasPrice and baseCost in the transaction, a re-estimation of fee may generate errors.
    const tx = await govContract.callZkSync(
      zkSyncAddress,
      COUNTER_ADDRESS,
      data,
      gasLimit,
      utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
      {
        // Pass the necessary ETH `value` to cover the fee for the operation
        value: baseCost,
        gasPrice,
        gasLimit: 1000000,
      },
    );
    console.log(`n-🔴 => main => tx:`, tx);
    // Wait until the L1 tx is complete.
    const rcpt = await tx.wait();
    console.log(`n-🔴 => main => rcpt:`, rcpt);
  };

  const loadL1Data = async () => {
    try {
      console.log(`n-🔴 => loadL1Data => loadL1Data:`);
      const l1Provider = new ethers.providers.JsonRpcProvider("https://goerli.blockpi.network/v1/rpc/public");
      setL1Provider(l1Provider);
      const wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider);
      setWallet(wallet);

      const govcontract = new Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, wallet);
      setGovContract(govcontract);

      const l2Provider = new Provider("https://zksync2-testnet.zksync.dev");
      setL2Provider(l2Provider);

      const zkSyncAddress = await l2Provider.getMainContractAddress();
      setZkSyncAddress(zkSyncAddress);
      const zkSyncContract = new Contract(zkSyncAddress, utils.ZKSYNC_MAIN_ABI, wallet);
      setZkSyncContract(zkSyncContract);

      const counterInterface = new ethers.utils.Interface(COUNTER_ABI);
      setCounterInterface(counterInterface);
    } catch (error) {
      console.log(`n-🔴 => loadL1Data => error:`, error);
    }
  };

  useEffect(() => {
    loadL1Data();
  }, []);

  return (
    <>
      <MetaHeader />

      <div className="flex items-center flex-col flex-grow pt-10">
        <div>count from L2</div>
        <div>{totalCounter?.toString()}</div>
        <button className="btn btn-primary" onClick={onIncrement}>
          Increment +
        </button>
      </div>
    </>
  );
};

export default Home;
