import connectToDatabase from "./mongodb";
import User from "@/models/User";
import { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const circle = new CircleDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

export async function getOrCreateCircleWallet(userId: string) {
  await connectToDatabase();

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.circleWalletId && user.circleWalletAddress) {
    return {
      circleWalletId: user.circleWalletId,
      circleWalletAddress: user.circleWalletAddress,
    };
  }

  const walletSetId = process.env.CIRCLE_WALLET_SET_ID!;
  if (!walletSetId) throw new Error("Missing CIRCLE_WALLET_SET_ID");

  const response = await circle.createWallets({
    walletSetId,
    accountType: "SCA",
    blockchains: ["MATIC-AMOY"],
    count: 1,
  });

  if (!response.data || response.data.wallets.length === 0) {
    throw new Error("Circle returned no wallets");
  }

  const wallet = response.data.wallets[0];

  user.circleWalletId = wallet.id;
  user.circleWalletAddress = wallet.address;
  await user.save();

  return {
    circleWalletId: wallet.id,
    circleWalletAddress: wallet.address,
  };
}
