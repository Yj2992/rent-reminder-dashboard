import Link from "next/link"
import { useEffect, useRef } from "react"

export default function Failed() {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (boxRef.current) {
      // shake animation when component mounts
      boxRef.current.classList.add("animate-shake")
      setTimeout(() => boxRef.current?.classList.remove("animate-shake"), 600)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
      <div
        ref={boxRef}
        className="bg-white shadow-2xl rounded-2xl p-10 max-w-md w-full text-center border border-red-100"
      >
        <div className="text-red-600 text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Payment Failed</h1>
        <p className="text-gray-600 mb-8">Something went wrong. Please try again.</p>

        <Link
          href="/"
          className="block w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-600 hover:shadow-lg transition transform hover:scale-[1.02]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}