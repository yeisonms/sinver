import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SalesTab from "./SalesTab";
import ArqueosTab from "./ArqueosTab";

export default function SalesPage() {
  return (
    <Tabs defaultValue="ventas" className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-4">
        <TabsList className="bg-transparent h-10 p-0 gap-0">
          <TabsTrigger
            value="ventas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 text-sm font-medium"
          >
            Ventas
          </TabsTrigger>
          <TabsTrigger
            value="arqueos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 text-sm font-medium"
          >
            Arqueos
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="ventas" className="flex-1 mt-0 overflow-hidden">
        <SalesTab />
      </TabsContent>
      <TabsContent value="arqueos" className="flex-1 mt-0 overflow-hidden">
        <ArqueosTab />
      </TabsContent>
    </Tabs>
  );
}
