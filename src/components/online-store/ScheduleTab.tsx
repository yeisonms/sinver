import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useRestaurantInfo, RestaurantInfo, OpeningHours, DaySchedule } from "@/hooks/useRestaurantInfo";
import { Loader2, Plus, Trash2 } from "lucide-react";

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

interface Props {
  info: RestaurantInfo;
}

export function ScheduleTab({ info }: Props) {
  const { update, isUpdating, DEFAULT_OPENING_HOURS } = useRestaurantInfo();

  // Merge saved hours with defaults to ensure all days exist
  const initialHours: OpeningHours = {
    ...DEFAULT_OPENING_HOURS,
    ...(info.opening_hours && typeof info.opening_hours === "object"
      ? Object.fromEntries(
          DAYS.map(({ key }) => [
            key,
            (info.opening_hours as OpeningHours)[key] || DEFAULT_OPENING_HOURS[key],
          ])
        )
      : {}),
  };

  const [hours, setHours] = useState<OpeningHours>(initialHours);

  const updateDay = (day: keyof OpeningHours, partial: Partial<DaySchedule>) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...partial },
    }));
  };

  const updateSlot = (day: keyof OpeningHours, idx: number, field: "open" | "close", value: string) => {
    setHours((prev) => {
      const newSlots = [...prev[day].slots];
      newSlots[idx] = { ...newSlots[idx], [field]: value };
      return { ...prev, [day]: { ...prev[day], slots: newSlots } };
    });
  };

  const addSlot = (day: keyof OpeningHours) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: [...prev[day].slots, { open: "12:00", close: "22:00" }] },
    }));
  };

  const removeSlot = (day: keyof OpeningHours, idx: number) => {
    setHours((prev) => {
      const newSlots = prev[day].slots.filter((_, i) => i !== idx);
      return { ...prev, [day]: { ...prev[day], slots: newSlots.length ? newSlots : [{ open: "08:00", close: "22:00" }] } };
    });
  };

  const handleSave = () => {
    update({ opening_hours: hours as any });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horarios de Atención</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map(({ key, label }) => {
          const day = hours[key];
          return (
            <div key={key} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{label}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {day.enabled ? "Abierto" : "Cerrado"}
                  </span>
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(key, { enabled: v })}
                  />
                </div>
              </div>

              {day.enabled && (
                <div className="space-y-2 pl-1">
                  {day.slots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.open}
                        onChange={(e) => updateSlot(key, idx, "open", e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input
                        type="time"
                        value={slot.close}
                        onChange={(e) => updateSlot(key, idx, "close", e.target.value)}
                        className="w-32"
                      />
                      {day.slots.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeSlot(key, idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSlot(key)}
                    className="mt-1"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Agregar turno
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Horarios
        </Button>
      </CardContent>
    </Card>
  );
}
