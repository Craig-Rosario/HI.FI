"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"

export default function Faq() {
  return (
    <section id="faq" className="bg-black text-white border-t border-white">
      <div className="mx-auto max-w-4xl px-6 pt-28 pb-40">

        <div className="mb-20 border-b-2 border-white pb-10">
          <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            F<span className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">A</span>Q
          </h2>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">
            Common questions about pooled finance
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">

          <AccordionItem
            value="item-1"
            className="bg-black border-2 border-white/20 transition-all duration-300 hover:border-white/40"
          >
            <AccordionTrigger className="text-left text-lg font-black py-6 px-6 hover:no-underline cursor-pointer transition-colors hover:text-blue-400">
              Is my money safe in a pooled investment?
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 leading-relaxed px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
              Yes. Funds are held in non-custodial smart contracts on the blockchain. No one — not even us — can move your funds without your wallet signature.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="bg-black border-2 border-white/20 transition-all duration-300 hover:border-white/40"
          >
            <AccordionTrigger className="text-left text-lg font-black py-6 px-6 hover:no-underline cursor-pointer transition-colors hover:text-blue-400">
              Can I withdraw my money anytime?
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 leading-relaxed px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
              Yes. You can withdraw your share of the pool at any time based on the smart contract rules and available liquidity.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-3"
            className="bg-black border-2 border-white/20 transition-all duration-300 hover:border-white/40"
          >
            <AccordionTrigger className="text-left text-lg font-black py-6 px-6 hover:no-underline cursor-pointer transition-colors hover:text-blue-400">
              Who controls how the pooled funds are invested?
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 leading-relaxed px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
              Each pool defines its own strategy. Some are managed by smart contracts, others by elected pool managers, and all actions are visible on-chain.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-4"
            className="bg-black border-2 border-white/20 transition-all duration-300 hover:border-white/40"
          >
            <AccordionTrigger className="text-left text-lg font-black py-6 px-6 hover:no-underline cursor-pointer transition-colors hover:text-blue-400">
              What happens if one person leaves the pool?
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 leading-relaxed px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
              Nothing breaks. The pool automatically recalculates ownership and distributes funds fairly when someone withdraws.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-5"
            className="bg-black border-2 border-white/20 transition-all duration-300 hover:border-white/40"
          >
            <AccordionTrigger className="text-left text-lg font-black py-6 px-6 hover:no-underline cursor-pointer transition-colors hover:text-blue-400">
              Do I need to trust other people in the pool?
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 leading-relaxed px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
              No. You don’t need to trust people — you only trust the smart contract. All balances, deposits, and withdrawals are enforced by code.
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </section>
  )
}
