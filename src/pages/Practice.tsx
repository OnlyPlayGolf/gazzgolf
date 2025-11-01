import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopNavBar } from "@/components/TopNavBar";
import DrillsCategories from "./DrillsCategories";
import LevelSelection from "./LevelSelection";

const Practice = () => {
  const [activeTab, setActiveTab] = useState("drills");

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice</h1>
          <p className="text-muted-foreground">Improve your game with drills and levels</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="drills">Drills</TabsTrigger>
            <TabsTrigger value="levels">Levels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="drills" className="mt-0">
            <DrillsCategories />
          </TabsContent>
          
          <TabsContent value="levels" className="mt-0">
            <LevelSelection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Practice;
