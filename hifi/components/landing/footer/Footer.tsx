import { Github } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-black border-t-2 border-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Brand Section */}
          <div>
            <h3 className="font-black text-2xl tracking-tighter text-white">
              HI.FI
            </h3>
            <p className="font-bold text-white mt-1">
              Trust the process.
            </p>
            <p className="text-gray-400 text-sm font-medium">
              Non-custodial DeFi made simple.
            </p>
          </div>

          {/* GitHub Icon */}
          <a 
            href="https://github.com/Craig-Rosario/HI.FI" 
            target="_blank" 
            rel="noopener noreferrer"
            className="border-2 border-white rounded-lg p-2 text-white hover:bg-white hover:text-black transition"
          >
            <Github className="w-6 h-6" />
          </a>

        </div>

        {/* Divider */}
        <div className="border-t-4 border-white mt-8 pt-6">
          <p className="text-gray-400 text-sm text-center">
            © 2026 HI.FI. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  )
}

export default Footer
