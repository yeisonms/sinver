import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DateTimeHeader() {
    const [time, setTime] = useState(new Date());
    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Format strings according to image_0.png
    // Example: "LUNES"
    const dayName = format(time, "EEEE", { locale: es }).toUpperCase();

    // Example: "02 MAR."
    const dateStr = format(time, "dd MMM.", { locale: es }).toUpperCase();

    // Example: "15:09"
    const timeStr = format(time, "HH:mm");

    return (
        <div className="w-full flex justify-between items-center bg-white px-6 py-2 border-b-[5px] border-[#F26522] relative shrink-0">
            {/* Settings Icon - Left */}
            <button
                onClick={() => navigate("/admin/settings")}
                className="text-[#F26522] hover:bg-muted p-2 rounded-full transition-colors focus:outline-none"
            >
                <Settings className="w-8 h-8" strokeWidth={1.5} />
            </button>

            {/* Date & Time Clock - Right */}
            <div className="flex items-center text-[#4A5568]">
                {/* Date Container (Stacked Text) */}
                <div className="flex flex-col items-end justify-center mr-3 font-semibold text-[13px] leading-[14px]">
                    <span className="tracking-wider text-muted-foreground">{dayName}</span>
                    <span className="tracking-wider">{dateStr}</span>
                </div>

                {/* Large Time Display */}
                <div className="text-4xl font-light text-[#42526E] tracking-tight">
                    {timeStr}
                </div>
            </div>
        </div>
    );
}
