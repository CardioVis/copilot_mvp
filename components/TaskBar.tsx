"use client";

interface TaskBarProps {
    isAnimating: boolean;
    onToggleAnimation: () => void;
}

export default function TaskBar({ isAnimating, onToggleAnimation }: TaskBarProps) {
    return (
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
            {/* Left section */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 font-semibold">
                    CARDIOVIS
                </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleAnimation}
                    className={`border-2 rounded-md px-4 py-2 shadow transition-colors text-sm font-semibold flex gap-2 items-center ${
                        isAnimating
                            ? "border-amber-500 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                    }`}
                >
                    {isAnimating ? "⏸ Pause" : "▶ Play"}
                </button>
                <button className="hover:bg-red-brand/60 border-red-brand border-2 text-white rounded-md px-4 py-2 shadow transition-colors text-sm font-semibold flex gap-2 items-center">
                    Capture
                </button>
            </div>
        </header>
    );
}
