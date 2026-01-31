import { ArrowRight } from "lucide-react"

const howItWorks = [
  {
    number: "01",
    title: "Connect Your Wallet",
    description:
      "Link your MetaMask or any Web3 wallet to start. Your funds stay in your control at all times — we never custody user assets."
  },
  {
    number: "02",
    title: "Join or Create a Pool",
    description:
      "Pick an existing investment pool or create one with friends, a DAO, or a community. Everyone deposits into the same smart contract."
  },
  {
    number: "03",
    title: "Capital Gets Deployed",
    description:
      "The pooled capital is deployed into DeFi strategies like lending, yield farming, or vaults, unlocking higher returns than solo investing."
  },
  {
    number: "04",
    title: "Earn & Withdraw Anytime",
    description:
      "Your share grows as the pool earns yield. Withdraw anytime based on your ownership — trustless, transparent, on-chain."
  }
]

export default function Working() {
  return (
    <section id="how-it-works" className="bg-black text-white border-t border-white">
      <div className="mx-auto max-w-7xl px-6 py-24">
        
        <div className="mb-20 border-b-2 border-white pb-10">
          <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">
            Get started in four simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {howItWorks.map((step, idx) => {
            const colors = [
              "border-blue-900 text-blue-400 bg-blue-500/10",
              "border-red-500 text-red-400 bg-red-500/10",
              "border-green-500 text-green-400 bg-green-500/10",
              "border-purple-500 text-purple-400 bg-purple-500/10"
            ]

            return (
              <div key={idx} className="relative">
                <div className={`h-full border-2 p-8 ${colors[idx]} flex flex-col`}>
                  
                  <div className="text-6xl font-black mb-6 opacity-80">
                    {step.number}
                  </div>

                  <h3 className="text-xl font-black mb-4">
                    {step.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed grow">
                    {step.description}
                  </p>
                </div>

                {idx < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute -mr-2 -right-5 top-1/2 -translate-y-1/2 text-white">
                    <ArrowRight size={32} strokeWidth={3} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
