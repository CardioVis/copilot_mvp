"use client";

export default function TaskBar() {
    return (
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
            {/* Left section */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 font-semibold">
                    CARDIOVIS
                </div>
            </div>

            {/* Right section */}
            <div className="">
                <button className="bg-red-brand hover:bg-red-brand/60 text-white rounded-md px-4 py-2 shadow transition-colors text-sm font-semibold flex gap-2 items-center">
                    Capture
                </button>
            </div>
        </header>
    );
}
