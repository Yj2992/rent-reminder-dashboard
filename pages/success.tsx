import Link from "next/link"
import { useEffect } from "react"

export default function Success() {
  useEffect(() => {
    // dynamically import canvas-confetti to avoid SSR issues
    import("canvas-confetti").then((confetti) => {
      const duration = 2 * 1000 // 2 seconds
      const end = Date.now() + duration

      ;(function frame() {
        confetti.default({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 }, // left side
        })
        confetti.default({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 }, // right side
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      })()
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <div className="bg-white shadow-2xl rounded-2xl p-10 max-w-md w-full text-center border border-green-100">
        <div className="text-green-600 text-6xl mb-4 animate-bounce">✅</div>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-8">Your rent has been paid securely. 🎉</p>

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