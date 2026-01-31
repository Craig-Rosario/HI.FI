
// import { LandingNavbar } from "@/components/navbar/Navbar"

import Faq from "@/components/landing/faq/Faq";
import Footer from "@/components/landing/footer/Footer";
import Hero from "@/components/landing/hero/Hero";
import Working from "@/components/landing/working/Working";
import Navbar from "@/components/navbar/Navbar";


export default function Home() {
  return (
    <>
      <Navbar />
      <main className="m-0 ">
        <Hero />
        <Working/>
        <Faq/>
        <Footer/>
      </main>
    </>
  )
}
