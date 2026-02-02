// Get relayer address for frontend
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return relayer address from env
  const relayerAddress = process.env.RELAYER_ADDRESS || '0xC11291d70fE1Efeddeb013544abBeF49B14981B8';

  return res.json({ relayerAddress });
}
