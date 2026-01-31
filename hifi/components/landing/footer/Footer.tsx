const Footer = () => {
  return (
    <footer className="bg-black border-t-4 border-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">

        <div className="grid md:grid-cols-4 gap-12 mb-12 pb-12 border-b-2 border-white">

          <div>
            <h3 className="font-black text-2xl mb-4 tracking-tighter text-white">
              HI.FI
            </h3>
            <p className="text-gray-400 text-sm font-medium">
              Pooled finance platform for modern investors.
            </p>
          </div>

          <div>
            <h4 className="font-black mb-6 text-sm tracking-widest uppercase text-white">
              Product
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white font-bold transition">Features</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Pricing</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Security</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black mb-6 text-sm tracking-widest uppercase text-white">
              Company
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white font-bold transition">About</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Blog</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Careers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black mb-6 text-sm tracking-widest uppercase text-white">
              Legal
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white font-bold transition">Privacy</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Terms</a></li>
              <li><a href="#" className="hover:text-white font-bold transition">Contact</a></li>
            </ul>
          </div>

        </div>

        <div className="pt-8">
          <p className="text-gray-400 text-sm text-center font-bold uppercase tracking-widest">
            © 2025 HI.FI. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  )
}

export default Footer
