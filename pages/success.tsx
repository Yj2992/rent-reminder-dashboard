import Link from "next/link"
import { useRouter } from "next/router"

export default function Success() {
  const router = useRouter()
  const invoice = Array.isArray(router.query.invoice) ? router.query.invoice[0] : router.query.invoice
  const token = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 py-6 text-[#17211f]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full max-w-md rounded-lg border border-[#cfe4d7] bg-white p-6 shadow-sm">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f8ef] text-xl font-bold text-[#207348]">
            ✓
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#207348]">Payment successful</p>
          <h1 className="mt-2 text-3xl font-bold">Rent payment received</h1>
          <p className="mt-3 text-[#5d6d68]">
            Your payment was verified securely. A paid receipt will be sent to your email.
          </p>

          {invoice && (
            <div className="mt-5 rounded-lg border border-[#e1e8e6] bg-[#f8faf9] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7e79]">Invoice ID</p>
              <p className="mt-2 break-words font-mono text-sm text-[#17211f]">{invoice}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {token && (
              <Link
                href={`/pay/${encodeURIComponent(token)}`}
                className="block w-full rounded-lg border border-[#bfd6cf] px-4 py-3 text-center font-semibold text-[#1f6f5b] transition hover:bg-[#eef7f3]"
              >
                View invoice status
              </Link>
            )}
            <Link
              href="/"
              className="block w-full rounded-lg bg-[#1f6f5b] px-4 py-3 text-center font-semibold text-white transition hover:bg-[#185846]"
            >
              Done
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
