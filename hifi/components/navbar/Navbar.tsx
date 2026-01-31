'use client'

const navigation = [
  { name: 'Product', href: '#' },
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'FAQ', href: '#faq' },
]

const Navbar = () => {
  return (
    <header className="relative w-full bg-black">
      
      <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

      <div className="border-b border-white/15">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between h-20">

            <div className="text-2xl font-black tracking-tight text-white">
              HI.FI
            </div>

            <nav className="hidden md:flex items-center gap-10">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white transition"
                >
                  {item.name}
                </a>
              ))}
            </nav>

          </div>
        </div>
      </div>

    </header>
  )
}

export default Navbar
