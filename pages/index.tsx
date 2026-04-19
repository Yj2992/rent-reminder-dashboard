import Link from "next/link"
import { useState } from "react"

export default function Home() {
  const [paymentToken, setPaymentToken] = useState("")

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Navbar */}
      <header className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 shadow-lg backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-wide">
            🏠 Rentomatic
          </h1>
          <span className="text-sm opacity-90">Tenant Portal</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="bg-white shadow-2xl rounded-2xl p-10 max-w-md w-full text-center border border-gray-100 transform transition duration-500 hover:scale-[1.02]">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-3">
            Welcome to <span className="text-blue-600">Rentomatic</span>
          </h1>
          <p className="text-gray-500 mb-8 text-base">
            Open your secure invoice link and complete payment in a few taps
          </p>

          {/* Input with icon */}
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 mb-5 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm">
            <span className="mr-2">🔑</span>
            <input
              type="text"
              placeholder="Enter payment token"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent"
            />
          </div>

          <Link
            href={paymentToken ? `/pay/${paymentToken}` : "#"}
            className={`block w-full py-3 rounded-lg text-white font-semibold tracking-wide transition transform ${
              paymentToken
                ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:scale-[1.02] shadow-md"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            🚀 Proceed to Payment
          </Link>

          <div className="mt-8 text-sm text-gray-500">
            Powered by <span className="font-bold text-blue-600">Razorpay</span>
          </div>
        </div>
      </main>
    </div>
  )
}
