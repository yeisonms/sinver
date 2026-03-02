import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useOrders } from "@/hooks/useOrders";
import { useAudioStore } from "@/hooks/useAudioStore";

export function AudioAlertProvider({ children }: { children: React.ReactNode }) {
    const [isBlocked, setIsBlocked] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const location = useLocation();

    // Disable the entire audio system if the user is currently on the public storefront
    const isPublicMenu = location.pathname.startsWith("/menu");

    // Bind strictly to the global React Query state so that it updates instantly
    // the moment the CounterPage finishes accepting/rejecting the order and invalidates the cache.
    const { data: inboxOrders = [] } = useOrders(isPublicMenu ? [] : ["pendiente_online"]);
    const { silencedIds } = useAudioStore();

    // Filter out orders that the user has immediately acknowledged (silenced)
    // but haven't yet been fully processed with WhatsApp timings.
    const activeAlarms = inboxOrders.filter((o) => !silencedIds.includes(o.id));
    const pendingCount = isPublicMenu ? 0 : activeAlarms.length;

    // 4. Handle audio playback based on count bounds
    useEffect(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;

        if (pendingCount > 0) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsBlocked(false);
                    // If the user accepted the order *while* the browser was spinning up the audio engine,
                    // we must immediately kill it the moment it successfully starts.
                    if (pendingCount === 0) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                }).catch((error) => {
                    console.warn("Audio autoplay blocked:", error);
                    setIsBlocked(true);
                });
            }
        } else {
            // Forceful stop when counter reaches zero
            audio.pause();
            audio.currentTime = 0;
            setIsBlocked(false);
        }
    }, [pendingCount]);

    const handleEnableAudio = () => {
        if (audioRef.current && pendingCount > 0) {
            audioRef.current.play()
                .then(() => setIsBlocked(false))
                .catch(console.error);
        } else {
            setIsBlocked(false);
        }
    };

    if (isPublicMenu) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
            {/* Native browser audio element directly tied to the React DOM */}
            <audio ref={audioRef} src="/bell.mp3" loop preload="auto" />

            {isBlocked && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
                    <div className="text-sm font-medium">🔔 Alertas en silencio por el navegador</div>
                    <button
                        onClick={handleEnableAudio}
                        className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-sm font-bold transition-colors whitespace-nowrap"
                    >
                        Activar Sonido
                    </button>
                </div>
            )}
        </>
    );
}
