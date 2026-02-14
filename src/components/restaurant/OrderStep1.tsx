import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface Props {
  clientName: string;
  setClientName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  userId: string;
  onContinue: () => void;
}

export function OrderStep1({ clientName, setClientName, notes, setNotes, userId, onContinue }: Props) {
  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <Label>Cliente</Label>
        <Input placeholder="Nombre del cliente..." value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Mesero / Cajero</Label>
        <Input value={userId} disabled className="bg-muted" />
      </div>
      <div className="space-y-2">
        <Label>Comentario General</Label>
        <Textarea placeholder="Notas del pedido..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <Button className="w-full gap-2" onClick={onContinue}>
        Continuar a Productos
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
