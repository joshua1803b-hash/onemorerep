export default function HomeScreen({ onNavigate }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white px-4">
      <div className="space-y-4 w-full max-w-xs">
        <button
          onClick={() => onNavigate('today')}
          className="w-full py-4 bg-white border border-black text-black font-semibold rounded transition-colors hover:bg-divider"
        >
          Start Workout
        </button>

        <button
          onClick={() => onNavigate('history')}
          className="w-full py-4 bg-white border border-black text-black font-semibold rounded transition-colors hover:bg-divider"
        >
          History
        </button>

        <button
          onClick={() => onNavigate('me')}
          className="w-full py-4 bg-white border border-black text-black font-semibold rounded transition-colors hover:bg-divider"
        >
          Me
        </button>
      </div>
    </div>
  )
}
