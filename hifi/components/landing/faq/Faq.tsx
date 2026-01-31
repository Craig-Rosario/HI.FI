"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "Is my money safe in a pooled investment?",
    answer:
      "Yes. Funds are held in non-custodial smart contracts on the blockchain. No one — not even us — can move your funds without your wallet signature."
  },
  {
    question: "Can I withdraw my money anytime?",
    answer:
      "Yes. You can withdraw your share of the pool at any time based on the smart contract rules and available liquidity."
  },
  {
    question: "Who controls how the pooled funds are invested?",
    answer:
      "Each pool defines its own strategy. Some are managed by smart contracts, others by elected pool managers, and all actions are visible on-chain."
  },
  {
    question: "What happens if one person leaves the pool?",
    answer:
      "Nothing breaks. The pool automatically recalculates ownership and distributes funds fairly when someone withdraws."
  },
  {
    question: "Do I need to trust other people in the pool?",
    answer:
      "No. You don’t need to trust people — you only trust the smart contract. All balances, deposits, and withdrawals are enforced by code."
  },
  {
    question: "What wallets are supported?",
    answer:
      "MetaMask is supported at launch, with WalletConnect and hardware wallets coming soon."
  }
]

export default function Faq() {
  return (
    <section id="faq" className="bg-black text-white border-t border-white overflow-visible">
      <div className="mx-auto max-w-4xl px-6 py-28">

        <div className="mb-20 border-b-2 border-white pb-10">
          <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            F<span className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">A</span>Q
          </h2>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">
            Common questions about pooled finance
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="
                bg-black border-2 border-white/20
                transition-all duration-300
                hover:border-white/40
              "
            >
              <AccordionTrigger
                className="
                  text-left text-lg font-black py-6 px-6
                  hover:no-underline
                  cursor-pointer
                  transition-colors
                  hover:text-blue-400
                "
              >
                {faq.question}
              </AccordionTrigger>

              <AccordionContent
                className="
                  text-gray-400 leading-relaxed px-6 pb-8
                  animate-in fade-in slide-in-from-top-2 duration-300
                "
              >
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

      </div>
    </section>
  )
}
