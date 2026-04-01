"use client";

export type AppTab = "endoscopy" | "gallery";

interface TaskBarProps {
    isAnimating: boolean;
    onToggleAnimation: () => void;
    activeTab: AppTab;
    onTabChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string }[] = [
    { id: "endoscopy", label: "Endoscopy" },
    { id: "gallery", label: "Image Gallery" },
];

export default function TaskBar({ isAnimating, onToggleAnimation, activeTab, onTabChange }: TaskBarProps) {
    return (
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
            {/* Left section: logo + tabs */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 font-semibold">
                    CARDIOVIS
                </div>
                <nav className="flex items-center gap-1">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? "bg-zinc-700 text-zinc-100"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
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
