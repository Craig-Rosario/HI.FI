import { ArrowRight } from "lucide-react"

const howItWorks = [
  {
    number: "01",
    title: "Connect Your Wallet",
    description:
      "Connect your wallet to get started. Your funds remain in your control and fully onchain at all times."
  },
  {
    number: "02",
    title: "Join a Pool",
    description:
      "Join an existing pool with others. Deposits are pooled in USDC and managed by transparent smart contracts."
  },
  {
    number: "03",
    title: "Capital Gets Deployed",
    description:
      "Pooled USDC is routed across chains and deployed according to the pool's strategy, with execution handled automatically."
  },
  {
    number: "04",
    title: "Earn & Withdraw Anytime",
    description:
      "Track your position and withdraw based on pool rules and ownership. Every action is transparent and verifiable onchain."
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
            FOUR STEPS. ONE APPROVAL.
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
