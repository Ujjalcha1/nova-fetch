import { FaYoutube } from 'react-icons/fa'

export default function Hero() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-red-500 via-pink-500 to-violet-600 shadow-[0_0_60px_rgba(236,72,153,.5)]">
        <FaYoutube className="text-white" size={48} />
      </div>

      <h1 className="mt-8 text-5xl font-extrabold">NovaFetch</h1>

      <p className="mt-3 text-lg text-gray-300">Download Anything</p>
    </div>
  )
}
